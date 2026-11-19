import {RegisterForm} from "../components/registerForm.tsx";
import {NavBar} from "../../../shared/components/navBar.tsx";

export const RegisterPage = () => (
    <div className='min-h-full bg-page pb-24'>
        <NavBar/>
        <div className='grid place-items-center px-4 pt-10 md:pt-20'>
            <RegisterForm/>
        </div>
    </div>
)
