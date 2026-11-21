import {useQuery} from "@tanstack/react-query";
import type {Point} from "../map/types.ts";
import {getPath} from "../routing/requests.ts";
import {cumulative, pointAt} from "../routing/lib/path.ts";
import type {TrackSample} from "../track/requests.ts";
import type {MarkerRow} from "../map/components/mapView.tsx";
import {useDemo} from "./demoStore.ts";

// Демо-світ: кільце справжніми вулицями центру Житомира (маршрут бере OpenRouteService),
// уздовж нього — ділянки різного стану, ями й позначки. Усе вигадане і живе лише в браузері.
const LOOP: Point[] = [
    {lat: 50.25450, lng: 28.65830},   // Майдан Корольова
    {lat: 50.25900, lng: 28.66520},   // Михайлівська
    {lat: 50.25640, lng: 28.67350},   // Велика Бердичівська
    {lat: 50.25150, lng: 28.66600},   // Київська
    {lat: 50.25450, lng: 28.65830},
]

export const DEMO_SPEED = 1.4          // м/с — швидкість демо-пристрою (як людина на колясці)

// Стан дороги вздовж кільця: [від, до] частки довжини → RMS струсу (g)
const ROUGHNESS: [number, number, number][] = [
    [0, 0.18, 0.03], [0.18, 0.33, 0.09], [0.33, 0.45, 0.19], [0.45, 0.68, 0.035],
    [0.68, 0.8, 0.31], [0.8, 0.9, 0.1], [0.9, 1, 0.04],
]
export const demoRmsAt = (frac: number) => ROUGHNESS.find(([a, b]) => frac >= a && frac < b)?.[2] ?? 0.04

type DemoMarkerDef = { at: number, severity: 'ok' | 'warning' | 'bad', typeId: number, slug: string, label: string, text: string, device?: boolean, daysAgo: number }
const MARKERS: DemoMarkerDef[] = [
    {at: 0.40, severity: 'bad', typeId: 4, slug: 'pothole', label: 'Яма / нерівність', text: 'Глибока яма біля бордюру', daysAgo: 2},
    {at: 0.74, severity: 'bad', typeId: 4, slug: 'pothole', label: 'Яма / нерівність', text: 'Вибоїна на всю ширину тротуару', daysAgo: 5},
    {at: 0.25, severity: 'warning', typeId: 3, slug: 'obstacle', label: 'Перешкода', text: 'Розбита плитка, колеса провалюються', daysAgo: 9},
    {at: 0.56, severity: 'ok', typeId: 1, slug: 'ramp', label: 'Пандус', text: 'Зручний пологий пандус до переходу', daysAgo: 14},
    {at: 0.63, severity: 'warning', typeId: 2, slug: 'noise', label: 'Шум', text: 'Шумне перехрестя, погано чути сигнал світлофора', daysAgo: 3},
    {at: 0.30, severity: 'warning', typeId: 7, slug: 'point', label: 'Точка з пристрою', text: "Високий бордюр без з'їзду", device: true, daysAgo: 1},
    {at: 0.77, severity: 'bad', typeId: 7, slug: 'point', label: 'Точка з пристрою', text: 'Тут застряг передніми колесами', device: true, daysAgo: 1},
]

export type DemoWorld = {
    path: Point[]
    cum: number[]
    length: number
    track: TrackSample[]
    markers: MarkerRow[]
    pits: Point[]                     // місця ям (для демо-пристрою на сторінці «Наживо»)
}

const build = (path: Point[]): DemoWorld => {
    const cum = cumulative(path)
    const length = cum[cum.length - 1]
    const now = Date.now() / 1000

    // Трек: точка кожні 8 м, як пише пристрій із кнопкою 2
    const track: TrackSample[] = []
    const n = Math.floor(length / 8)
    for (let i = 0; i <= n; i++) {
        const d = i * 8
        const {p} = pointAt(path, cum, d)
        const base = demoRmsAt(d / length)
        track.push({lat: p.lat, lng: p.lng, rms: base * (0.85 + 0.3 * Math.abs(Math.sin(i * 1.7))), t: now - (n - i) * 6})
    }

    const markers = MARKERS.map((m, i) => {
        const {p} = pointAt(path, cum, m.at * length)
        return {
            id: `demo-${i}`,
            user_id: null,
            type_id: m.typeId,
            lat: p.lat,
            lng: p.lng,
            description: m.text,
            source: m.device ? 'device' : 'user',
            created_at: new Date(Date.now() - m.daysAgo * 864e5).toISOString(),
            severity: m.severity,
            device_id: null,
            event_id: null,
            marker_types: {slug: m.slug, label: m.label},
            profiles: m.device ? null : {display_name: 'Демо-користувач'},
            voice_notes: [],
        } as unknown as MarkerRow
    })

    const pits = MARKERS.filter((m) => m.severity === 'bad').map((m) => pointAt(path, cum, m.at * length).p)
    return {path, cum, length, track, markers, pits}
}

const fetchWorld = async (): Promise<DemoWorld> => {
    try {
        const r = await getPath(LOOP, 'foot-walking')
        return build(r.path)
    } catch {
        return build(LOOP)        // без мережі маршрутів — просто ламана між точками
    }
}

export const isDemoId = (id: string) => id.startsWith('demo-')

// Демо-світ завантажується один раз, коли увімкнено демо-режим
export const useDemoWorld = () => {
    const on = useDemo((s) => s.on)
    const q = useQuery({queryKey: ['demo-world'], queryFn: fetchWorld, enabled: on, staleTime: Infinity, gcTime: Infinity})
    return on ? q.data ?? null : null
}

// Де зараз демо-пристрій: однаково на всіх сторінках, бо рахується від годинника
export const demoDeviceAt = (w: DemoWorld, ms = Date.now()) => {
    const d = ((ms / 1000) * DEMO_SPEED) % w.length
    return {...pointAt(w.path, w.cum, d), dist: d}
}
