import {useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {getMarkers} from "../requests.ts";
import {useDemoWorld} from "../../demo/demoWorld.ts";

// У демо-режимі до справжніх позначок додаються вигадані (ями, пандуси, точки з пристрою)
export const useMarkers = () => {
    const q = useQuery({queryKey: ['markers'], queryFn: getMarkers})
    const world = useDemoWorld()
    const data = useMemo(() => world ? [...world.markers, ...(q.data ?? [])] : q.data, [world, q.data])
    return {...q, data}
}
