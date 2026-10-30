import type {Route, ScoredRoute, ScoringMarker} from "../types.ts";
import {distanceToSegment} from "./geo.ts";
import {RADIUS_M, SEVERITY_WEIGHT} from "./constants.ts"

export const scoreRoute = (route: Route, markers: ScoringMarker[]): ScoredRoute => {
    let fine = 0
    for (const marker of markers) {
        const weight = SEVERITY_WEIGHT[marker.severity]
        if (!weight) continue

        let nearest = Infinity
        for (let i = 0; i < route.path.length - 1; i++) {
            const d = distanceToSegment(marker, route.path[i], route.path[i + 1])
            nearest = Math.min(nearest, d)
        }

        if (nearest < RADIUS_M) fine += weight * (1 - nearest / RADIUS_M)
    }
    return {...route, fine}
}