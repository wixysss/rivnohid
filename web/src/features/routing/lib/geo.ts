import type {Point} from "../../map/types.ts";

const toMeters = (p: Point, k: number) => {
    return {
        x: p.lng * k * 111320,
        y: p.lat * 110540
    }
}

export const distanceToSegment = (p: Point, a: Point, b: Point) => {
    const k = Math.cos(p.lat * Math.PI / 180)
    const P = toMeters(p, k)
    const A = toMeters(a, k)
    const B = toMeters(b, k)

    const dx = B.x - A.x
    const dy = B.y - A.y
    const lenSq = dx * dx + dy * dy

    if (lenSq === 0) return Math.hypot(P.x - A.x, P.y - A.y)

    let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const cx = A.x + t * dx
    const cy = A.y + t * dy
    return Math.hypot(P.x - cx, P.y - cy)
}