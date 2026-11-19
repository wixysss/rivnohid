import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {registerSchema, type RegisterValues} from "../shemas.ts";
import {Link} from "react-router-dom";
import {signUp} from "../requests.ts";
import {btn, field} from "../../../shared/ui/card.tsx";

export const RegisterForm = () => {
    const {register, handleSubmit, setError, formState: {errors, isSubmitting}} =
        useForm<RegisterValues>({resolver: zodResolver(registerSchema)})

    const onSubmit = async (data: RegisterValues) => {
        try {
            await signUp(data)
        } catch {
            setError('root', {message: 'Не вдалося зареєструватися: можливо, ця пошта вже зайнята'})
        }
    }
    return (
        <form noValidate onSubmit={handleSubmit(onSubmit)}
              className='flex w-full max-w-[420px] flex-col gap-3 rounded-3xl border border-line bg-white p-7'>
            <h1 className='text-[26px] font-bold'>Реєстрація</h1>

            <label htmlFor='name' className='text-sm font-semibold'>Ім'я</label>
            <input id='name' type='text' autoComplete='name' {...register('displayName')} placeholder="Як до вас звертатися" className={field}/>
            {errors.displayName && <span className='text-sm text-sos'>{errors.displayName.message}</span>}

            <label htmlFor='email' className='mt-1 text-sm font-semibold'>Пошта</label>
            <input id='email' autoComplete='email' {...register('email')} placeholder='name@example.com' type='email' className={field}/>
            {errors.email && <span className='text-sm text-sos'>{errors.email.message}</span>}

            <label htmlFor='password' className='mt-1 text-sm font-semibold'>Пароль</label>
            <input id='password' autoComplete='new-password' {...register('password')} placeholder='Пароль' type='password' className={field}/>
            {errors.password && <span className='text-sm text-sos'>{errors.password.message}</span>}

            <button type='submit' disabled={isSubmitting} className={`${btn.primary} mt-3 py-3`}>Зареєструватися</button>
            {errors.root && <p className='text-sm text-sos'>{errors.root.message}</p>}
            <p className='mt-1 text-center text-sm text-muted'>
                Вже є акаунт? <Link className='font-semibold text-brand' to='/login'>Увійти</Link>
            </p>
        </form>
    )
}
