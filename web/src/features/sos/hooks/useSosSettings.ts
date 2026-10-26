import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {getSosSettings, setSosSettings} from "../requests.ts";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";

export const useSosSettings = () => {
    const session = useAuthStore((s) => s.session)
    return useQuery({
        queryKey: ['sos-settings', session?.user.id],
        queryFn: getSosSettings,
        enabled: !!session,          // номер бачать лише залогінені
    })
}

export const useSaveSosSettings = () => {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({name, phone}: { name: string, phone: string }) => setSosSettings(name, phone),
        onSuccess: () => qc.invalidateQueries({queryKey: ['sos-settings']}),
    })
}
