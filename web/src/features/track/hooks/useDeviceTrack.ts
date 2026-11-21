import {useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {getDeviceTrack} from "../requests.ts";
import {useDemoWorld} from "../../demo/demoWorld.ts";

// Трек оновлюється раз на 30 с: пристрій досилає його пачками раз на 20 с.
// У демо-режимі — записаний «пристроєм» трек демо-кільця.
export const useDeviceTrack = () => {
    const q = useQuery({
        queryKey: ['device-track'],
        queryFn: () => getDeviceTrack(30),
        refetchInterval: 30000,
        refetchOnWindowFocus: false,
    })
    const world = useDemoWorld()
    const data = useMemo(() => world ? [...(q.data ?? []), ...world.track] : q.data, [world, q.data])
    return {...q, data}
}
