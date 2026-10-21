import {Navigate, Outlet} from "react-router";
import {useAuthStore} from "../store/useAuthStore.ts";
import {Loader} from "../../../shared/components/loader.tsx";

export const ProtectedOnlyRoute = () => {
    const user = useAuthStore((state) => state.session?.user)
    const isLoading = useAuthStore((state) => state.isLoading)
    if (isLoading) return <Loader/>;
    return (user ? <Outlet/> : <Navigate to='/'/>)
}