import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {loginSchema, type LoginValues} from "../shemas.ts";
import {Link} from "react-router-dom";
import {signIn} from "../requests.ts";
import {btn, field} from "../../../shared/ui/card.tsx";

export const LoginForm = () => {
    const {register, handleSubmit, setError, formState: {errors, isSubmitting}} =
        useForm<LoginValues>({resolver: zodResolver(loginSchema)})

    const onSubmit = async (data: LoginValues) => {
        try {
            await signIn(data)
        } catch {
            setError('root', {message: 'Невірна пошта або пароль'})
        }
    }
    return (
        <form noValidate onSubmit={handleSubmit(onSubmit)}
              className='flex w-full max-w-[420px] flex-col gap-3 rounded-3xl border border-line bg-white p-7'>
            <h1 className='text-[26px] font-bold'>Вхід</h1>
            <p className='-mt-1 mb-1 text-sm text-muted'>Щоб додавати позначки, писати нотатки й налаштувати SOS.</p>

            <label htmlFor='email' className='text-sm font-semibold'>Пошта</label>
            <input id='email' {...register('email')} autoComplete='email' placeholder='name@example.com' type='email' className={field}/>
            {errors.email && <span className='text-sm text-sos'>{errors.email.message}</span>}

            <label htmlFor='password' className='mt-1 text-sm font-semibold'>Пароль</label>
            <input id='password' {...register('password')} autoComplete='current-password' placeholder='Пароль' type='password' className={field}/>
            {errors.password && <span className='text-sm text-sos'>{errors.password.message}</span>}

            <button type='submit' disabled={isSubmitting} className={`${btn.primary} mt-3 py-3`}>Увійти</button>
            {errors.root && <p className='text-sm text-sos'>{errors.root.message}</p>}
            <p className='mt-1 text-center text-sm text-muted'>
                Ще немає акаунта? <Link className='font-semibold text-brand' to='/register'>Зареєструватися</Link>
            </p>
        </form>
    )
}
