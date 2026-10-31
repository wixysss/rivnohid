import {useQuery} from "@tanstack/react-query";
import {getDeviceTrack} from "../requests.ts";

// Трек оновлюється раз на 30 с: пристрій досилає його пачками раз на 20 с
export const useDeviceTrack = () => useQuery({
    queryKey: ['device-track'],
    queryFn: () => getDeviceTrack(30),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
})
