import type {TrackSample} from "../requests.ts";
import {distanceToSegment} from "../../routing/lib/geo.ts";

export type RoadLevel = 'ok' | 'warning' | 'bad'

// Ті самі межі, що на пристрої та сторінці /live (RMS вертикального струсу, g)
export const levelOf = (rms: number): RoadLevel => rms >= 0.14 ? 'bad' : rms >= 0.06 ? 'warning' : 'ok'

export const LEVEL_COLOR: Record<RoadLevel, string> = {ok: '#22c55e', warning: '#eab308', bad: '#ef4444'}
export const LEVEL_LABEL: Record<RoadLevel, string> = {ok: 'Рівно', warning: 'Нерівно', bad: 'Погано'}

export type TrackRun = { level: RoadLevel, path: [number, number][] }

const MAX_GAP_S = 90      // довша пауза — новий шматок (пристрій вимикали або губився GPS)
const MAX_JUMP_M = 60     // стрибок координат більший за це — теж розрив

const meters = (a: TrackSample, b: TrackSample) => distanceToSegment(a, b, b)

// Трек → шматки однакового кольору. Колір відрізка між двома точками — гірший з двох.
export const toRuns = (samples: TrackSample[]): TrackRun[] => {
    const runs: TrackRun[] = []
    let cur: TrackRun | null = null
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i]
        if (b.t - a.t > MAX_GAP_S || meters(a, b) > MAX_JUMP_M) {
            cur = null
            continue
        }
        const la = levelOf(a.rms), lb = levelOf(b.rms)
        const level: RoadLevel = la === 'bad' || lb === 'bad' ? 'bad' : la === 'warning' || lb === 'warning' ? 'warning' : 'ok'
        if (cur && cur.level === level) {
            cur.path.push([b.lat, b.lng])
        } else {
            cur = {level, path: [[a.lat, a.lng], [b.lat, b.lng]]}
            runs.push(cur)
        }
    }
    return runs
}

// Довжина обстежених доріг за рівнями, км
export const trackStats = (runs: TrackRun[]) => {
    const km: Record<RoadLevel, number> = {ok: 0, warning: 0, bad: 0}
    for (const r of runs) {
        for (let i = 1; i < r.path.length; i++) {
            const [la, lo] = r.path[i - 1], [lb, lob] = r.path[i]
            km[r.level] += distanceToSegment({lat: la, lng: lo}, {lat: lb, lng: lob}, {lat: lb, lng: lob}) / 1000
        }
    }
    return {...km, total: km.ok + km.warning + km.bad}
}

// Для навігатора: нерівні місця треку як «штрафні» точки, не густіше ніж раз на ~15 м
export const roughSpots = (samples: TrackSample[]) => {
    const seen = new Set<string>()
    const out: { lat: number, lng: number, severity: 'warning' | 'bad' }[] = []
    for (const s of samples) {
        const level = levelOf(s.rms)
        if (level === 'ok') continue
        const key = `${Math.round(s.lat / 0.00015)}:${Math.round(s.lng / 0.0002)}:${level}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({lat: s.lat, lng: s.lng, severity: level})
    }
    return out
}
