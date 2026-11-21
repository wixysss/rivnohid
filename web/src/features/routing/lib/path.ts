import type {Point} from "../../map/types.ts";

// Відстань між двома точками, м (рівнокутна проєкція — точно на кількох кілометрах)
export const meters = (a: Point, b: Point) => {
    const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
    return Math.hypot((b.lng - a.lng) * k * 111320, (b.lat - a.lat) * 110540)
}

// Накопичена довжина ламаної в кожній вершині
export const cumulative = (path: Point[]) => {
    const d = [0]
    for (let i = 1; i < path.length; i++) d.push(d[i - 1] + meters(path[i - 1], path[i]))
    return d
}

// Точка на ламаній через dist метрів від початку + напрям руху (градуси від півночі)
export const pointAt = (path: Point[], cum: number[], dist: number): { p: Point, heading: number, index: number } => {
    if (path.length < 2) return {p: path[0], heading: 0, index: 0}
    const total = cum[cum.length - 1]
    const d = Math.max(0, Math.min(total, dist))
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const a = path[i - 1], b = path[i]
    const seg = cum[i] - cum[i - 1] || 1
    const t = (d - cum[i - 1]) / seg
    const p = {lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t}
    const k = Math.cos(a.lat * Math.PI / 180)
    const heading = (Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180 / Math.PI + 360) % 360
    return {p, heading, index: i}
}

// Відрізок ламаної між двома відстанями (для «пройдено» / «залишилось»)
export const slice = (path: Point[], cum: number[], from: number, to: number): Point[] => {
    const a = pointAt(path, cum, from), b = pointAt(path, cum, to)
    const mid = path.slice(a.index, b.index)
    return [a.p, ...mid, b.p]
}

// Найближча до точки позиція на ламаній: відстань уздовж ламаної і відстань від неї
export const project = (path: Point[], cum: number[], q: Point) => {
    let best = {along: 0, off: Infinity}
    const k = Math.cos(q.lat * Math.PI / 180)
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i]
        const ax = a.lng * k * 111320, ay = a.lat * 110540
        const bx = b.lng * k * 111320, by = b.lat * 110540
        const qx = q.lng * k * 111320, qy = q.lat * 110540
        const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1
        const t = Math.max(0, Math.min(1, ((qx - ax) * dx + (qy - ay) * dy) / len))
        const off = Math.hypot(qx - (ax + t * dx), qy - (ay + t * dy))
        if (off < best.off) best = {along: cum[i - 1] + t * (cum[i] - cum[i - 1]), off}
    }
    return best
}

// Багатокутник-«коло» навколо точки для avoid_polygons в OpenRouteService
export const circlePolygon = (c: Point, r: number, n = 12): [number, number][] => {
    const k = Math.cos(c.lat * Math.PI / 180)
    const ring: [number, number][] = []
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        ring.push([c.lng + (r * Math.cos(a)) / (111320 * k), c.lat + (r * Math.sin(a)) / 110540])
    }
    return ring
}
