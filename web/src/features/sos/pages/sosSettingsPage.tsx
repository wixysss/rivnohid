import {useEffect} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {Loader} from "../../../shared/components/loader.tsx";
import {useSaveSosSettings, useSosSettings} from "../hooks/useSosSettings.ts";
import {normalizePhone} from "../requests.ts";
import {btn, field} from "../../../shared/ui/card.tsx";

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
        <div className='min-h-full bg-page pb-24'>
            <NavBar/>
            <main className='mx-auto max-w-xl px-4 pt-8'>
                <h1 className='mb-2 text-[28px] font-bold tracking-tight'>Екстрений контакт (SOS)</h1>
                <p className='mb-5 text-[15px] text-muted'>
                    Цьому номеру пристрій подзвонить і надішле SMS з координатами, коли на ньому
                    утримати кнопку 4 дві секунди. Без номера SOS лише з'явиться тривогою на сайті.
                </p>

                {!isLoading && !loadError && !data?.sos_phone && (
                    <div className='mb-5 rounded-2xl border border-[#f3c4bf] bg-sos-soft p-3.5 text-sm text-sos'>
                        Номер для SOS ще не вказано. Заповніть його, щоб кнопка SOS могла комусь подзвонити.
                    </div>
                )}

                {isLoading ? <Loader/> : (
                    <form noValidate onSubmit={handleSubmit(onSubmit)}
                          className='flex flex-col gap-2 rounded-3xl border border-line bg-white p-6'>
                        <label htmlFor='sos-name' className='text-sm font-semibold'>Ім'я (необов'язково)</label>
                        <input id='sos-name' {...register('name')} placeholder='Мама'
                               className={field}/>
                        {errors.name && <span className='text-sm text-sos'>{errors.name.message}</span>}

                        <label htmlFor='sos-phone' className='mt-2 text-sm font-semibold'>
                            Номер телефону <span className='text-sos'>*</span>
                        </label>
                        <input id='sos-phone' {...register('phone')} type='tel' inputMode='tel' required
                               placeholder='+380501234567' autoComplete='tel'
                               className={field}/>
                        {errors.phone && <span className='text-sm text-sos'>{errors.phone.message}</span>}

                        <button type='submit' disabled={isSubmitting || save.isPending}
                                className={`${btn.primary} mt-4 py-3`}>
                            {save.isPending ? 'Зберігаю…' : 'Зберегти'}
                        </button>
                        {save.isSuccess && <p className='text-sm text-brand'>Збережено. Пристрій оновить номер протягом 10 хвилин або після перезапуску.</p>}
                        {save.error && <p className='text-sm text-sos'>{save.error.message}</p>}
                        {loadError && <p className='text-sm text-sos'>Не вдалося завантажити: {loadError.message}</p>}
                    </form>
                )}

                {data?.sos_phone && (
                    <p className='mt-4 text-sm text-muted'>
                        Зараз: <a className='font-semibold text-brand' href={`tel:${data.sos_phone}`}>{data.sos_phone}</a>
                        {data.sos_name ? ` (${data.sos_name})` : ''}
                    </p>
                )}
            </main>
        </div>
    )
}
