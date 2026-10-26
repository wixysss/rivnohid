import {Link} from "react-router-dom";
import type {SosAlert} from "../liveStore.ts";
import {useSosSettings} from "../../sos/hooks/useSosSettings.ts";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";

// Тривога SOS з пристрою: номер для дзвінка бачать лише залогінені
export const SosBanner = ({sos, onDismiss}: { sos: SosAlert, onDismiss: () => void }) => {
    const session = useAuthStore((s) => s.session)
    const {data} = useSosSettings()
    const phone = data?.sos_phone
    const map = sos.lat != null && sos.lon != null ? `https://maps.google.com/?q=${sos.lat},${sos.lon}` : null

    return (
        <div role='alert' className='mb-4 rounded-xl border-2 border-red-600 bg-red-50 p-4'>
            <div className='flex flex-wrap items-center gap-3'>
                <span className='animate-pulse rounded-lg bg-red-600 px-3 py-1 text-lg font-bold text-white'>SOS</span>
                <div className='flex-1 min-w-48'>
                    <p className='font-semibold text-red-800'>З пристрою натиснули кнопку SOS о {sos.time.toLocaleTimeString('uk-UA')}</p>
                    <p className='text-sm text-red-700'>
                        {sos.called ? 'Пристрій дзвонить на екстрений номер.' : 'Пристрій не зміг подзвонити сам (немає SIM800L).'}
                        {map ? <> Місце: <a className='underline' href={map} target='_blank' rel='noreferrer'>{sos.lat!.toFixed(5)}, {sos.lon!.toFixed(5)}</a></> : ' Координат немає (GPS без фіксу).'}
                    </p>
                </div>
                {phone ? (
                    <a href={`tel:${phone}`} className='rounded-lg bg-red-600 px-4 py-2 font-semibold text-white'>
                        Подзвонити {data?.sos_name ?? phone}
                    </a>
                ) : session ? (
                    <Link to='/settings/sos' className='rounded-lg bg-red-600 px-4 py-2 text-white'>Вказати номер SOS</Link>
                ) : (
                    <Link to='/login' className='rounded-lg bg-red-600 px-4 py-2 text-white'>Увійти, щоб подзвонити</Link>
                )}
                <button onClick={onDismiss} className='rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700'>
                    Закрити
                </button>
            </div>
        </div>
    )
}

// Нагадування: номер SOS обов'язковий
export const SosMissingNotice = () => {
    const session = useAuthStore((s) => s.session)
    const {data, isSuccess} = useSosSettings()
    if (!session || !isSuccess || data?.sos_phone) return null
    return (
        <div className='mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'>
            Номер для SOS не вказано: кнопка 4 на пристрої нікому не подзвонить.
            <Link to='/settings/sos' className='ml-auto rounded-lg bg-amber-500 px-3 py-1 text-white'>Вказати номер</Link>
        </div>
    )
}
