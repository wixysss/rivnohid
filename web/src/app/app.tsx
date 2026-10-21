import './app.css'
import {Provider} from "./provider.tsx";
import {Router} from "./router.tsx";
import {useAuth} from "../features/auth/hooks/useAuth.ts";

function App() {
    useAuth()
    return (
        <>
            <Provider>
                <Router/>
            </Provider>
        </>
    )
}

export default App
