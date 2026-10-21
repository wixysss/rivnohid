import {useQuery} from "@tanstack/react-query";
import {getMarkerTypes} from "../requests.ts";

export const useMarkerTypes = () => useQuery({
    queryKey: ['marker-types'],
    queryFn: () => getMarkerTypes()
})