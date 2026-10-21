import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {registerSchema, type RegisterValues} from "../shemas.ts";
import {Link} from "react-router-dom";
import {signUp} from "../requests.ts";

export const RegisterForm = () => {

    const {register, handleSubmit, setError, formState: {errors, isSubmitting}} =
        useForm<RegisterValues>({resolver: zodResolver(registerSchema)})

    const onSubmit = async (data: RegisterValues) => {
        try {
            await signUp(data)
        } catch {
            setError('root', {message: 'Registration failed; the email address may already be in use'})
        }
    }
    return (
        <form noValidate onSubmit={handleSubmit(onSubmit)}
              className='border border-[#e9e9e9] shadow-[0_12px_30px_rgba(0,0,0,0.08)] rounded-xl p-5 w-full max-w-100 box-border m-5 flex flex-col justify-around'>
            <h1 className='text-center text-[30px]'>Sign up</h1>

            <label htmlFor='name' className='text-[#7d4153]'>Name</label>
            <input
                id='name'
                type='text'
                autoComplete='name'
                {...register('displayName')}
                placeholder='Enter your name'
                className='font-thin focus:outline-none transition-all duration-300 hover:border-blue-600 border border-[#d1d5dc] rounded-lg p-1.5 pr-2'
            />
            {errors.displayName && <span className='text-red-500'>{errors.displayName.message}</span>}

            <label htmlFor='email' className='text-[#7d4153]'>Email</label>
            <input id='email'
                   autoComplete='email'
                   {...register('email')}
                   placeholder='Enter your email'
                   type='email'
                   className='font-thin focus:outline-none transition-all duration-300 hover:border-blue-600 border border-[#d1d5dc] rounded-lg p-1.5 pr-2'
            />
            {errors.email && <span className='text-red-500'>{errors.email.message}</span>}

            <label htmlFor='password' className='text-[#7d4153]'>Password</label>
            <input id='password'
                   autoComplete='new-password'
                   {...register('password')}
                   placeholder='Enter your password'
                   className='font-thin focus:outline-none transition-all duration-300 hover:border-blue-600 border border-[#d1d5dc] rounded-lg p-1.5 pr-2'
                   type='password'
            />
            {errors.password && <span className='text-red-500'>{errors.password.message}</span>}

            <button type='submit'
                    disabled={isSubmitting}
                    className='mt-2 text-white cursor-pointer rounded-lg p-2 border border-[#e9e9e9] bg-[#2a78d6]'
            >Sign up
            </button>

            {errors.root && <p className='text-red-500'>{errors.root.message}</p>}
            <p className='text-center mt-2 text-[#bccfd5] font-thin'>
                Already have an account? <Link className='text-[#2a78d6]' to='/login'>Login</Link>
            </p>
        </form>
    )
}