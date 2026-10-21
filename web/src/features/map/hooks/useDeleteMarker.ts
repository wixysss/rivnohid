import {useMutation, useQueryClient} from "@tanstack/react-query";
import {deleteMarker} from "../requests.ts";

export const useDeleteMarker = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: deleteMarker,
        onSuccess: () => queryClient.invalidateQueries({queryKey:['markers']})
    })
}