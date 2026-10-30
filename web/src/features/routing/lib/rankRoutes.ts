import type {Route, ScoredRoute, ScoringMarker} from "../types.ts";
import {scoreRoute} from "./scoreRoute.ts";

export const rankRoutes = (routes:Route[],markers:ScoringMarker[]):ScoredRoute[] => {
    const scored = routes.map((route) => scoreRoute(route,markers))
    return scored.sort((a, b) => a.fine - b.fine || a.duration - b.duration)
}