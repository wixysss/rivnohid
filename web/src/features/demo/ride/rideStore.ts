import {create} from "zustand";
import type {Point} from "../../map/types.ts";
import {getPath, type OrsProfile} from "../../routing/requests.ts";
import {circlePolygon, cumulative, meters, pointAt, project, slice} from "../../routing/lib/path.ts";

// Демо-поїздка навігатора: «пристрій» їде обраним маршрутом у реальному часі (з прискоренням),
// бачить яму попереду, зупиняється, просить у OpenRouteService маршрут в обхід і їде далі.

export type HazardState = 'hidden' | 'ahead' | 'avoided' | 'passed' | 'unavoidable'
export type Hazard = { id: string, p: Point, label: string, kind: 'pit' | 'slow', fresh?: boolean, appearAt?: number, state: HazardState }
export type RideLog = { t: number, text: string, tone: 'info' | 'warn' | 'ok' }
export type RideStatus = 'off' | 'running' | 'paused' | 'rerouting' | 'done'

type RideState = {
    status: RideStatus
    plan: Point[]
    dist: number
    pos: Point | null
    heading: number
    trail: Point[]
    abandoned: Point[][]
    hazards: Hazard[]
    log: RideLog[]
    speed: number          // м/с «у світі поїздки»
    mul: number            // прискорення часу
    elapsed: number        // с «у світі поїздки»
    travelled: number      // м
    avoided: number
    extra: number          // скільки метрів додали об'їзди
    follow: boolean
    total: number          // довжина поточного плану, м
}

export type RideHazardInput = { id: string, lat: number, lng: number, label: string, severity: string }
export type RideStart = { path: Point[], dest: Point, profile: OrsProfile, baseSpeed: number, markers: RideHazardInput[] }

const LOOKAHEAD = 70        // за скільки метрів «помічаємо» яму на маршруті
const ON_ROUTE = 18         // яма ближче за це до лінії — вона на маршруті
const AVOID_R = 24          // радіус зони, яку просимо оминути
const FRAME_MS = 50         // як часто оновлюємо стан для React

const idle: RideState = {
    status: 'off', plan: [], dist: 0, pos: null, heading: 0, trail: [], abandoned: [], hazards: [], log: [],
    speed: 0, mul: 8, elapsed: 0, travelled: 0, avoided: 0, extra: 0, follow: true, total: 0,
}

export const useRide = create<RideState>(() => ({...idle}))

// Внутрішній стан циклу (поза React, щоб не перемальовувати сторінку 60 разів на секунду)
let raf = 0
let token = 0
let cum: number[] = []
let dest: Point = {lat: 0, lng: 0}
let profile: OrsProfile = 'wheelchair'
let base = 1.1
let zones: [number, number][][] = []
let lastFrame = 0
let lastPush = 0

const set = useRide.setState
const get = useRide.getState
const say = (text: string, tone: RideLog['tone'] = 'info') => set((s) => ({log: [{t: s.elapsed, text, tone}, ...s.log].slice(0, 30)}))
const m = (x: number) => x < 1000 ? `${Math.round(x)} м` : `${(x / 1000).toFixed(1).replace('.', ',')} км`

const setPlan = (path: Point[], dist = 0) => {
    cum = cumulative(path)
    set({plan: path, dist, total: cum[cum.length - 1] ?? 0})
}

export const rideStart = ({path, dest: d, profile: p, baseSpeed, markers}: RideStart) => {
    rideStop()
    if (path.length < 2) return
    token++
    dest = d
    profile = p
    base = baseSpeed
    zones = []
    cum = cumulative(path)
    const total = cum[cum.length - 1]

    // Відомі проблеми з карти поблизу маршруту: ями — оминаємо, інше — пригальмовуємо
    const hazards: Hazard[] = markers
        .filter((mk) => mk.severity !== 'ok')
        .map((mk) => ({id: mk.id, p: {lat: mk.lat, lng: mk.lng}, label: mk.label, kind: mk.severity === 'bad' ? 'pit' as const : 'slow' as const, state: 'ahead' as const}))
        .filter((h) => project(path, cum, h.p).off < 300)

    // Головний момент демо: посеред маршруту з'являється свіжа яма, якої не було, коли маршрут будували
    if (total > 220) {
        const at = Math.max(110, Math.min(total * 0.55, total - 90))
        hazards.push({id: 'demo-fresh', p: pointAt(path, cum, at).p, label: 'Свіжа яма', kind: 'pit', fresh: true, appearAt: Math.max(15, at - 150), state: 'hidden'})
    }

    set({
        ...idle, mul: get().mul, follow: true, status: 'running', plan: path, total, pos: path[0], trail: [path[0]], hazards,
        log: [{t: 0, text: `Старт. До фінішу ${m(total)}`, tone: 'info'}],
    })
    lastFrame = performance.now()
    lastPush = 0
    raf = requestAnimationFrame(loop)
}

export const rideStop = () => {
    cancelAnimationFrame(raf)
    token++
    set({...idle, mul: get().mul})
}

export const ridePause = () => {
    const s = get().status
    if (s === 'running') set({status: 'paused'})
    else if (s === 'paused') { lastFrame = performance.now(); set({status: 'running'}) }
}
export const rideSetMul = (mul: number) => set({mul})
export const rideSetFollow = (follow: boolean) => set({follow})

// Локальні змінні кадру — щоб не смикати zustand частіше, ніж треба
let dist = 0, travelled = 0, elapsed = 0, speed = 0

const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const s = get()
    const dtReal = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    if (s.status === 'off' || s.status === 'done') return cancelAnimationFrame(raf)
    if (lastPush === 0) { dist = s.dist; travelled = s.travelled; elapsed = s.elapsed; speed = s.speed }
    if (s.status === 'paused') { lastPush = now; return }

    const dt = dtReal * s.mul
    elapsed += dt

    // Яка швидкість зараз: стоїмо, поки шукаємо об'їзд; повільніше біля перешкод
    let target = base
    if (s.status === 'rerouting') target = 0
    for (const h of s.hazards) {
        if (h.state === 'hidden' || h.state === 'avoided') continue
        const d = meters(h.p, s.pos ?? h.p)
        if (d < 25) target = Math.min(target, h.kind === 'pit' ? base * 0.3 : base * 0.55)
    }
    speed += (target - speed) * Math.min(1, dt * 1.5)
    const step = speed * dt
    dist = Math.min(s.total, dist + step)
    travelled += step

    const {p, heading} = pointAt(s.plan, cum, dist)

    // Події на шляху
    let hazards = s.hazards
    let changed = false
    for (const h of hazards) {
        if (h.state === 'hidden' && h.appearAt != null && dist >= h.appearAt && s.status === 'running') {
            h.state = 'ahead'; changed = true
            say('Новий звіт з пристрою: яма на маршруті попереду', 'warn')
        }
        if (h.state !== 'ahead' && h.state !== 'unavoidable') continue
        const pr = project(s.plan, cum, h.p)
        if (pr.off > ON_ROUTE) continue
        const ahead = pr.along - dist
        if (h.state === 'ahead' && h.kind === 'pit' && ahead > 0 && ahead < LOOKAHEAD && s.status === 'running') {
            void reroute(h, ahead)
            changed = true
        } else if (ahead < -8) {
            if (h.kind === 'slow' && h.state === 'ahead') say(`Проїхали повільно: ${h.label.toLowerCase()}`)
            if (h.state === 'unavoidable') say(`Обережно проїхали яму`, 'warn')
            h.state = 'passed'; changed = true
        }
    }
    if (changed) hazards = [...hazards]

    if (dist >= s.total - 0.5 && s.status === 'running') {
        set({status: 'done', dist, pos: p, heading, travelled, elapsed, speed: 0, hazards, trail: [...s.trail, p]})
        const a = get().avoided
        say(`Прибули за ${Math.max(1, Math.round(elapsed / 60))} хв. ${a ? `Оминули ям: ${a}` : 'Без ям на шляху'}`, 'ok')
        return
    }

    if (now - lastPush < FRAME_MS && !changed) return
    lastPush = now
    const last = s.trail[s.trail.length - 1]
    const trail = !last || meters(last, p) > 3 ? [...s.trail, p] : s.trail
    set({dist, pos: p, heading, travelled, elapsed, speed, hazards, trail})
}

const reroute = async (h: Hazard, ahead: number) => {
    const my = token
    set({status: 'rerouting'})
    say(`Яма за ${m(ahead)}: зупинка, шукаю об'їзд…`, 'warn')
    zones.push(circlePolygon(h.p, AVOID_R))
    const s = get()
    const from = s.pos ?? s.plan[0]
    const oldLeft = s.total - dist
    try {
        let r
        try {
            r = await getPath([from, dest], profile, zones)
        } catch {
            r = await getPath([from, dest], 'foot-walking', zones)
        }
        if (my !== token) return
        const rc = cumulative(r.path)
        if (project(r.path, rc, h.p).off < ON_ROUTE * 0.7) throw new Error('через яму')
        const cur = get()
        const abandoned = [...cur.abandoned, slice(cur.plan, cum, dist, cur.total)]
        const plus = Math.round(rc[rc.length - 1] - oldLeft)
        h.state = 'avoided'
        setPlan(r.path, 0)
        dist = 0
        set({abandoned, avoided: cur.avoided + 1, extra: cur.extra + Math.max(0, plus), hazards: [...cur.hazards], status: 'running'})
        say(plus > 5 ? `Об'їзд знайдено: +${m(plus)} до шляху` : "Об'їзд знайдено майже без гаку", 'ok')
    } catch {
        if (my !== token) return
        h.state = 'unavoidable'
        zones.pop()
        set({hazards: [...get().hazards], status: 'running'})
        say("Об'їзду немає: проїжджаю яму повільно", 'warn')
    }
}
