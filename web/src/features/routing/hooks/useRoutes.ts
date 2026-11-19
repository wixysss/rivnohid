import type {Point} from "../../map/types.ts";
import {skipToken, useQuery} from "@tanstack/react-query";
import {getRoutes, type OrsProfile} from "../requests.ts";

export const useRoutes = (from: Point | null, to: Point | null, profile: OrsProfile) => {
    return useQuery({
        queryKey: ['routes', from, to, profile],
        queryFn: from && to ? () => getRoutes(from, to, profile) : skipToken,
        refetchOnWindowFocus: false,
        retry: 1,
    })
}
