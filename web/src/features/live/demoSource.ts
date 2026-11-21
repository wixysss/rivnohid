import type {DeviceEvent, LivePacket, PointSeverity} from "./constants.ts";
import {DEMO_SPEED, type DemoWorld, demoDeviceAt, demoRmsAt} from "../demo/demoWorld.ts";
import {meters} from "../routing/lib/path.ts";
import {levelOfRms} from "./constants.ts";

const SEV: Record<string, PointSeverity> = {smooth: 'ok', uneven: 'warning', rough: 'warning', bad: 'bad'}

// Кнопки «пристрою» для презентації: їх натискають зі сторінки «Наживо»
let kick = false
let press: { point: () => void, sos: () => void } | null = null
export const demoButtons = {
    pit: () => { kick = true },
    point: () => press?.point(),
    sos: () => press?.sos(),
}

// Імітація пристрою для презентації без заліза: 10 пакетів на секунду.
// Якщо є демо-світ, «пристрій» їде тим самим кільцем, що й на карті та в навігаторі:
// трясе там, де погана дорога, підкидає на ямах, пише трек, ставить точки й записує голос.
export const startDemo = (onPacket: (p: LivePacket) => void, world: DemoWorld | null = null, onEvent?: (e: DeviceEvent) => void) => {
    let t = 0
    let seq = 0
    let lat = 50.2547
    let lon = 28.6587
    const hitPits = new Set<number>()
    let pointN = 0
    let script = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms))

    // Кнопка 2 — пишемо маршрут одразу; кнопка 3 і голос — по колу кожні ~25 с
    later(800, () => onEvent?.({type: 'track', on: true, n: 0}))

    let rough = 0.04
    const putPoint = (withVoice: boolean) => {
        const emit = onEvent
        if (!emit) return
        const n = ++pointN
        const sev = SEV[levelOfRms(rough)]
        const at = {lat, lon}
        emit({type: 'point', n, ...at, sev, sent: false})
        later(1500, () => emit({type: 'point', n, ...at, sev, sent: true, id: `demo-pt-${n}`}))
        if (withVoice) {
            later(2500, () => emit({type: 'rec', on: true, ...at, point: n}))
            later(7500, () => {
                emit({type: 'rec', on: false, ...at, point: n})
                emit({type: 'voice', id: '', ...at, dur: 5000})
            })
        }
    }
    press = {
        point: () => putPoint(false),
        sos: () => onEvent?.({type: 'sos', lat, lon, called: false}),
    }

    const id = setInterval(() => {
        let pothole: boolean
        if (world) {
            const {p, dist} = demoDeviceAt(world)
            lat = p.lat
            lon = p.lng
            rough = demoRmsAt(dist / world.length) * 1.1
            pothole = false
            for (let i = 0; i < world.pits.length; i++) {
                const d = meters(world.pits[i], p)
                if (d < 5 && !hitPits.has(i)) { hitPits.add(i); pothole = true }
                if (d > 30) hitPits.delete(i)
            }
            if (!pothole && rough > 0.15) pothole = Math.random() < 0.01
        } else {
            rough = 0.03 + 0.1 * (0.5 + 0.5 * Math.sin(t / 9)) + (Math.sin(t / 23) > 0.7 ? 0.12 : 0)
            pothole = Math.random() < 0.006
            lat += 0.0000035
            lon += 0.000005 * (1 + 0.3 * Math.sin(t / 15))
        }

        const a: number[] = []
        let sq = 0
        let pk = 0
        for (let i = 0; i < 20; i++) {
            let g = (Math.random() - 0.5) * 2 * rough + Math.sin((t + i / 200) * 40) * rough * 0.4
            if (pothole && i > 4 && i < 14) {
                g += Math.sin((i - 4) / 10 * Math.PI) * (i < 9 ? -1 : 1.6) * (0.7 + Math.random())
            }
            a.push(Math.round(g * 1000))
            sq += g * g
            pk = Math.max(pk, Math.abs(g))
        }
        if (kick) {
            kick = false
            for (let i = 5; i < 14; i++) {
                const g = Math.sin((i - 5) / 9 * Math.PI) * (i < 9 ? -1.1 : 1.8)
                a[i] += Math.round(g * 1000)
                sq += g * g
                pk = Math.max(pk, Math.abs(a[i]) / 1000)
            }
        }
        const rms = Math.sqrt(sq / 20)
        t += 0.1

        // Сценарій кнопок
        if (world && seq % 250 === 60) putPoint(script++ % 2 === 0)

        onPacket({
            seq: seq++, t: Math.round(t * 1000), a,
            rms, pk,
            bump: pk > 0.6 ? 1 : 0, mark: 0,
            lat, lon, spd: world ? DEMO_SPEED * 3.6 * (rough > 0.2 ? 0.6 : 1) + Math.sin(t / 3) * 0.3 : 4 + Math.sin(t / 5),
            sat: 9, bat: 3.9, trk: 1,
        })
    }, 100)

    return () => {
        clearInterval(id)
        timers.forEach(clearTimeout)
        press = null
    }
}
