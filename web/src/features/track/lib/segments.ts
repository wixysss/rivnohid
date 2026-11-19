import type {TrackSample} from "../requests.ts";
import {distanceToSegment} from "../../routing/lib/geo.ts";
import {levelOfRms} from "../../live/constants.ts";
import {LEVEL_META, LEVEL_ORDER, type RoadLevel} from "../../../shared/ui/levels.ts";

export type {RoadLevel}

// Ті самі межі, що на пристрої та сторінці «Наживо» (RMS вертикального струсу, g)
export const levelOf = (rms: number): RoadLevel => levelOfRms(rms)

export const LEVEL_COLOR: Record<RoadLevel, string> = {
    smooth: LEVEL_META.smooth.color, uneven: LEVEL_META.uneven.color, rough: LEVEL_META.rough.color, bad: LEVEL_META.bad.color,
}
export const LEVEL_LABEL: Record<RoadLevel, string> = {
    smooth: LEVEL_META.smooth.label, uneven: LEVEL_META.uneven.label, rough: LEVEL_META.rough.label, bad: LEVEL_META.bad.label,
}

export type TrackRun = { level: RoadLevel, path: [number, number][] }

const MAX_GAP_S = 90      // довша пауза — новий шматок (пристрій вимикали або губився GPS)
const MAX_JUMP_M = 60     // стрибок координат більший за це — теж розрив

const meters = (a: TrackSample, b: TrackSample) => distanceToSegment(a, b, b)
const worse = (a: RoadLevel, b: RoadLevel) => LEVEL_ORDER.indexOf(a) > LEVEL_ORDER.indexOf(b) ? a : b

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
        const level = worse(levelOf(a.rms), levelOf(b.rms))
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
    const km: Record<RoadLevel, number> = {smooth: 0, uneven: 0, rough: 0, bad: 0}
    for (const r of runs) {
        for (let i = 1; i < r.path.length; i++) {
            const [la, lo] = r.path[i - 1], [lb, lob] = r.path[i]
            km[r.level] += distanceToSegment({lat: la, lng: lo}, {lat: lb, lng: lob}, {lat: lb, lng: lob}) / 1000
        }
    }
    return {...km, total: km.smooth + km.uneven + km.rough + km.bad}
}

// Для навігатора: нерівні місця треку як «штрафні» точки, не густіше ніж раз на ~15 м
export const roughSpots = (samples: TrackSample[]) => {
    const seen = new Set<string>()
    const out: { lat: number, lng: number, severity: 'warning' | 'bad' }[] = []
    for (const s of samples) {
        const level = levelOf(s.rms)
        if (level === 'smooth') continue
        const severity = level === 'uneven' ? 'warning' : 'bad'
        const key = `${Math.round(s.lat / 0.00015)}:${Math.round(s.lng / 0.0002)}:${severity}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({lat: s.lat, lng: s.lng, severity})
    }
    return out
}
