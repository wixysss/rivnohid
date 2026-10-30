import type {Point} from "../../map/types.ts";
import {useRoutes} from "./useRoutes.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import {rankRoutes} from "../lib/rankRoutes.ts";
import {toScoringMarkers} from "../lib/toScoringMarkers.ts";

export const useRankedRoutes = (from: Point | null, to: Point | null) => {
    const routesQuery = useRoutes(from, to)
    const markersQuery = useMarkers()

    const routes = routesQuery.data && markersQuery.data ? rankRoutes(routesQuery.data, toScoringMarkers(markersQuery.data)) : undefined

    return {
        routes,
        isLoading: routesQuery.isLoading || markersQuery.isLoading,
        error: routesQuery.error ?? markersQuery.error
    }
}