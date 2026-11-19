import {useMemo} from "react";
import type {Point} from "../../map/types.ts";
import {useRoutes} from "./useRoutes.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import {rankRoutes} from "../lib/rankRoutes.ts";
import {toScoringMarkers} from "../lib/toScoringMarkers.ts";
import {useDeviceTrack} from "../../track/hooks/useDeviceTrack.ts";
import {roughSpots} from "../../track/lib/segments.ts";
import type {MOVERS} from "../profiles.ts";

export const useRankedRoutes = (from: Point | null, to: Point | null, mover: (typeof MOVERS)[number]) => {
    const routesQuery = useRoutes(from, to, mover.ors)
    const markersQuery = useMarkers()
    const trackQuery = useDeviceTrack()

    // Штраф маршруту: позначки на карті + нерівні ділянки, які проїхав пристрій
    const routes = useMemo(() => routesQuery.data && markersQuery.data
        ? rankRoutes(routesQuery.data, [...toScoringMarkers(markersQuery.data), ...roughSpots(trackQuery.data ?? [])], mover.weight)
        : undefined, [routesQuery.data, markersQuery.data, trackQuery.data, mover.weight])

    return {
        routes,
        isLoading: routesQuery.isLoading || markersQuery.isLoading,
        error: routesQuery.error ?? markersQuery.error
    }
}
