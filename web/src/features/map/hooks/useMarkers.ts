import {useQuery} from "@tanstack/react-query";
import {getMarkers} from "../requests.ts";

export const useMarkers = () => {
    return useQuery({queryKey: ['markers'], queryFn: getMarkers})
}