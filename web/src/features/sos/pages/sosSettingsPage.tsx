import {useEffect} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {Loader} from "../../../shared/components/loader.tsx";
import {useSaveSosSettings, useSosSettings} from "../hooks/useSosSettings.ts";
import {normalizePhone} from "../requests.ts";

const schema = z.object({
    name: z.string().trim().max(30, 'Максимум 30 символів'),
    phone: z.string().trim()
        .min(1, "Номер обов'язковий")
        .transform(normalizePhone)
        .refine((v) => /^\+?\d{7,15}$/.test(v), 'Невірний номер. Приклад: +380501234567'),
})
type Values = z.input<typeof schema>
type Parsed = z.output<typeof schema>

export const SosSettingsPage = () => {
    const {data, isLoading, error: loadError} = useSosSettings()
    const save = useSaveSosSettings()
    const {register, handleSubmit, reset, formState: {errors, isSubmitting}} =
        useForm<Values, unknown, Parsed>({resolver: zodResolver(schema), defaultValues: {name: '', phone: ''}})

    useEffect(() => {
        if (data) reset({name: data.sos_name ?? '', phone: data.sos_phone ?? ''})
    }, [data, reset])

    const onSubmit = (v: Parsed) => save.mutate({name: v.name, phone: v.phone})

    return (
        <div className='min-h-screen bg-zinc-50'>
            <NavBar/>
            <main className='mx-auto max-w-xl px-4 pb-10'>
                <h1 className='mb-1 text-2xl font-semibold'>Екстрений контакт (SOS)</h1>
                <p className='mb-4 text-sm text-zinc-600'>
                    Цьому номеру пристрій подзвонить і надішле SMS з координатами, коли на ньому
                    утримати кнопку 4 дві секунди. Без номера SOS лише з'явиться тривогою на сайті.
                </p>

                {!isLoading && !loadError && !data?.sos_phone && (
                    <div className='mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                        Номер для SOS ще не вказано. Заповніть його, щоб кнопка SOS могла комусь подзвонити.
                    </div>
                )}

                {isLoading ? <Loader/> : (
                    <form noValidate onSubmit={handleSubmit(onSubmit)}
                          className='flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4'>
                        <label htmlFor='sos-name' className='text-sm text-zinc-600'>Ім'я (необов'язково)</label>
                        <input id='sos-name' {...register('name')} placeholder='Мама'
                               className='rounded-lg border border-[#d1d5dc] p-2 focus:outline-none hover:border-blue-600'/>
                        {errors.name && <span className='text-sm text-red-500'>{errors.name.message}</span>}

                        <label htmlFor='sos-phone' className='mt-2 text-sm text-zinc-600'>
                            Номер телефону <span className='text-red-500'>*</span>
                        </label>
                        <input id='sos-phone' {...register('phone')} type='tel' inputMode='tel' required
                               placeholder='+380501234567' autoComplete='tel'
                               className='rounded-lg border border-[#d1d5dc] p-2 focus:outline-none hover:border-blue-600'/>
                        {errors.phone && <span className='text-sm text-red-500'>{errors.phone.message}</span>}

                        <button type='submit' disabled={isSubmitting || save.isPending}
                                className='mt-3 rounded-lg bg-[#2a78d6] p-2 text-white disabled:opacity-60'>
                            {save.isPending ? 'Зберігаю…' : 'Зберегти'}
                        </button>
                        {save.isSuccess && <p className='text-sm text-green-600'>Збережено. Пристрій оновить номер протягом 10 хвилин або після перезапуску.</p>}
                        {save.error && <p className='text-sm text-red-500'>{save.error.message}</p>}
                        {loadError && <p className='text-sm text-red-500'>Не вдалося завантажити: {loadError.message}</p>}
                    </form>
                )}

                {data?.sos_phone && (
                    <p className='mt-4 text-sm text-zinc-500'>
                        Зараз: <a className='text-[#2a78d6]' href={`tel:${data.sos_phone}`}>{data.sos_phone}</a>
                        {data.sos_name ? ` (${data.sos_name})` : ''}
                    </p>
                )}
            </main>
        </div>
    )
}
