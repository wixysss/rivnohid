import type {Point} from "../../map/types.ts";
import {useRoutes} from "./useRoutes.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import {rankRoutes} from "../lib/rankRoutes.ts";
import {toScoringMarkers} from "../lib/toScoringMarkers.ts";
import {useDeviceTrack} from "../../track/hooks/useDeviceTrack.ts";
import {roughSpots} from "../../track/lib/segments.ts";

export const useRankedRoutes = (from: Point | null, to: Point | null) => {
    const routesQuery = useRoutes(from, to)
    const markersQuery = useMarkers()
    const trackQuery = useDeviceTrack()

    // Штраф маршруту: позначки на карті + нерівні ділянки, які проїхав пристрій
    const routes = routesQuery.data && markersQuery.data
        ? rankRoutes(routesQuery.data, [...toScoringMarkers(markersQuery.data), ...roughSpots(trackQuery.data ?? [])])
        : undefined

    return {
        routes,
        isLoading: routesQuery.isLoading || markersQuery.isLoading,
        error: routesQuery.error ?? markersQuery.error
    }
}