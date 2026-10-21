import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {loginSchema, type LoginValues} from "../shemas.ts";
import {Link} from "react-router-dom";
import {signIn} from "../requests.ts";

export const LoginForm = () => {

    const {register, handleSubmit, setError, formState: {errors, isSubmitting}} =
        useForm<LoginValues>({resolver: zodResolver(loginSchema)})

    const onSubmit = async (data: LoginValues) => {
        try {
            await signIn(data)
        } catch {
            setError('root', {message: 'Incorrect email or password'})
        }
    }
    return (
        <form noValidate onSubmit={handleSubmit(onSubmit)}
              className='border border-[#e9e9e9] shadow-[0_12px_30px_rgba(0,0,0,0.08)] rounded-xl p-5 w-full max-w-100 box-border m-5 flex flex-col justify-around'>
            <h1 className='text-center text-[30px]'>Login</h1>
            <label htmlFor='email' className='text-[#7d4153]'>Email</label>
            <input id='email'
                   {...register('email')}
                   autoComplete='email'
                   placeholder='Enter your email'
                   type='email'
                   className='font-thin focus:outline-none transition-all duration-300 hover:border-blue-600 border border-[#d1d5dc] rounded-lg p-1.5 pr-2'
            />
            {errors.email && <span className='text-red-500'>{errors.email.message}</span>}

            <label htmlFor='password' className='text-[#7d4153]'>Password</label>
            <input id='password'
                   {...register('password')}
                   autoComplete='current-password'
                   placeholder='Enter your password'
                   className='font-thin focus:outline-none transition-all duration-300 hover:border-blue-600 border border-[#d1d5dc] rounded-lg p-1.5 pr-2'
                   type='password'
            />
            {errors.password && <span className='text-red-500'>{errors.password.message}</span>}

            <button type='submit'
                    disabled={isSubmitting}
                    className='mt-2 text-white cursor-pointer rounded-lg p-2 border border-[#e9e9e9] bg-[#2a78d6]'
            >Login
            </button>

            {errors.root && <p className='text-red-500'>{errors.root.message}</p>}
            <p className='text-center mt-2 text-[#bccfd5] font-thin'>
                Don't have an account? <Link className='text-[#2a78d6]' to='/register'>Register</Link>
            </p>
        </form>
    )
}