import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createMarker} from "../requests.ts";

export const useCreateMarker = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createMarker,
        onSuccess: () => queryClient.invalidateQueries({queryKey: ['markers']})
    })
}