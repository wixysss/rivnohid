import type {Route, ScoredRoute, ScoringMarker} from "../types.ts";
import {distanceToSegment} from "./geo.ts";
import {RADIUS_M, SEVERITY_WEIGHT} from "./constants.ts"

// weight — наскільки профіль руху чутливий до нерівностей (коляска 1, велосипед менше)
export const scoreRoute = (route: Route, markers: ScoringMarker[], weight = 1): ScoredRoute => {
    let fine = 0
    let problems = 0
    for (const marker of markers) {
        const w = SEVERITY_WEIGHT[marker.severity]
        if (!w) continue

        let nearest = Infinity
        for (let i = 0; i < route.path.length - 1; i++) {
            const d = distanceToSegment(marker, route.path[i], route.path[i + 1])
            nearest = Math.min(nearest, d)
        }

        if (nearest < RADIUS_M) {
            fine += w * weight * (1 - nearest / RADIUS_M)
            problems++
        }
    }
    return {...route, fine, problems}
}