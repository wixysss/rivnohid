import {Link, useNavigate} from "react-router-dom";
import {LuChevronRight, LuLogOut, LuPlus, LuSiren} from "react-icons/lu";
import {NavBar} from "../../shared/components/navBar.tsx";
import {useAuthStore} from "../auth/store/useAuthStore.ts";
import {signOut} from "../auth/requests.ts";
import {btn} from "../../shared/ui/card.tsx";
import {DemoRow} from "../../shared/components/demoToggle.tsx";

// Вкладка «Профіль» на телефоні (на комп'ютері те саме — у меню під іконкою)
export const ProfilePage = () => {
    const session = useAuthStore((s) => s.session)
    const navigate = useNavigate()
    const name = session?.user.user_metadata?.display_name as string | undefined
    const row = 'flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 font-medium'

    return (
        <div className='min-h-full bg-page pb-24'>
            <NavBar/>
            <main className='mx-auto flex max-w-md flex-col gap-3 px-4 pt-6'>
                <h1 className='text-2xl font-bold'>Профіль</h1>
                {session ? (
                    <>
                        <div className='rounded-2xl border border-line bg-white p-4'>
                            <p className='text-lg font-semibold'>{name || 'Мій профіль'}</p>
                            <p className='text-sm text-muted'>{session.user.email}</p>
                        </div>
                        <Link to='/settings/sos' className={row}>
                            <LuSiren className='text-sos' size={20}/> Екстрений контакт (SOS)
                            <LuChevronRight className='ml-auto text-faint'/>
                        </Link>
                        <Link to='/map/editor' className={row}>
                            <LuPlus size={20}/> Додати позначку на карту
                            <LuChevronRight className='ml-auto text-faint'/>
                        </Link>
                        <button onClick={async () => { await signOut(); navigate('/map') }}
                                className={`${row} text-sos`}>
                            <LuLogOut size={20}/> Вийти
                        </button>
                    </>
                ) : (
                    <div className='flex flex-col gap-3 rounded-2xl border border-line bg-white p-5'>
                        <p className='text-muted'>Увійдіть, щоб додавати позначки, писати нотатки в точках і вказати номер для SOS.</p>
                        <Link to='/login' className={btn.primary}>Увійти</Link>
                        <Link to='/register' className={btn.outline}>Зареєструватися</Link>
                    </div>
                )}
                <DemoRow/>
            </main>
        </div>
    )
}
