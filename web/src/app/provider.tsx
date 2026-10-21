import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ErrorBoundary} from "react-error-boundary";

const queryClient = new QueryClient()
export const Provider = ({children}: { children: React.ReactNode }) => {
    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary fallback={<div>Error</div>}>
                {children}
            </ErrorBoundary>
        </QueryClientProvider>
    )
}