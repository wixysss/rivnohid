import type {Point} from "../map/types.ts";
import type {MarkerValues} from "../map/schemas.ts";

export type Route = {
    id: number,
    path: Point[],
    distance: number,
    duration: number
}

export type ScoringMarker = {
    lat: number,
    lng: number,
    severity: MarkerValues['severity']
}

export type ScoredRoute = Route & { fine: number }