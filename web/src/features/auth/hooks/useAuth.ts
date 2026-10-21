import {useEffect} from "react";
import {useAuthStore} from "../store/useAuthStore.ts";
import {supabase} from "../../../shared/lib/supabase.ts";

export const useAuth = () => {
    const setSession = useAuthStore((s) => s.setSession)

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session)})
        return () => subscription.unsubscribe()
    }, [setSession])
}
