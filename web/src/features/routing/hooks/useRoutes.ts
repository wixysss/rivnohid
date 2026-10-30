import type {Point} from "../../map/types.ts";
import {skipToken, useQuery} from "@tanstack/react-query";
import {getRoutes} from "../requests.ts";

export const useRoutes = (from:Point | null, to: Point | null) => {
    return useQuery({
        queryKey: ['routes',from,to],
        queryFn: from && to ? () => getRoutes(from,to): skipToken,
        refetchOnWindowFocus: false
    })
}