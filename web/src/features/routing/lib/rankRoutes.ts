import type {Route, ScoredRoute, ScoringMarker} from "../types.ts";
import {scoreRoute} from "./scoreRoute.ts";

export const rankRoutes = (routes: Route[], markers: ScoringMarker[], weight = 1): ScoredRoute[] => {
    const scored = routes.map((route) => scoreRoute(route, markers, weight))
    return scored.sort((a, b) => a.fine - b.fine || a.duration - b.duration)
}