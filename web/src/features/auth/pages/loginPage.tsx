import {LoginForm} from "../components/loginForm.tsx";
import {NavBar} from "../../../shared/components/navBar.tsx";

export const LoginPage = () => {
    return (
        <>
            <NavBar/>
            <div className='h-screen grid place-items-center'>
                <LoginForm/>
            </div>
        </>

    )
}