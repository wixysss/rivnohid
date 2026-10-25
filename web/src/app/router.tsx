import {BrowserRouter, Route, Routes} from "react-router-dom";
import {PublicOnlyRoute} from "../features/auth/routes/publicOnlyRoute.tsx";
import {Navigate} from "react-router";
import {LoginPage} from "../features/auth/pages/loginPage.tsx";
import {RegisterPage} from "../features/auth/pages/registerPage.tsx";
import {ProtectedOnlyRoute} from "../features/auth/routes/protectedOnlyRoute.tsx";
import {MapPage} from "../features/map/pages/mapPage.tsx";
import {MapEditor} from "../features/map/pages/mapEditor.tsx";
import {LivePage} from "../features/live/pages/livePage.tsx";

export const Router = () => {
    return (
        <BrowserRouter>
            <Routes>

                <Route path='/' element={<Navigate to='/login'/>}/>
                <Route path='/map' element={<MapPage/>}/>
                <Route path='/live' element={<LivePage/>}/>

                <Route element={<PublicOnlyRoute/>}>

                    <Route path='/login' element={<LoginPage/>}/>
                    <Route path='/register' element={<RegisterPage/>}/>

                </Route>

                <Route element={<ProtectedOnlyRoute/>}>
                    <Route path='/map/editor' element={<MapEditor/>}/>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}