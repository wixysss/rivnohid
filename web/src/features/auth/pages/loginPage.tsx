import {LoginForm} from "../components/loginForm.tsx";
import {NavBar} from "../../../shared/components/navBar.tsx";

export const LoginPage = () => (
    <div className='min-h-full bg-page pb-24'>
        <NavBar/>
        <div className='grid place-items-center px-4 pt-10 md:pt-20'>
            <LoginForm/>
        </div>
    </div>
)
