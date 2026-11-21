import {Link, NavLink, useNavigate} from "react-router-dom";
import {useEffect, useRef, useState} from "react";
import {LuActivity, LuLogOut, LuMap, LuMapPin, LuNavigation, LuSiren, LuUser} from "react-icons/lu";
import {signOut} from "../../features/auth/requests.ts";
import {useAuthStore} from "../../features/auth/store/useAuthStore.ts";
import {NAV_LINKS} from "../constants.ts";
import {DemoToggle} from "./demoToggle.tsx";

export const Logo = ({compact = false}: { compact?: boolean }) => (
    <Link to='/map' className='flex items-center gap-2.5'>
        <span className='grid h-9 w-9 place-items-center rounded-xl bg-brand text-white'>
            <LuMapPin size={19} strokeWidth={2.4}/>
        </span>
        {!compact && <span className='text-[21px] font-bold tracking-tight text-ink'>Rivnohid</span>}
    </Link>
)

const ProfileMenu = () => {
    const session = useAuthStore((s) => s.session)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()

    useEffect(() => {
        if (!open) return
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [open])

    const name = session?.user.user_metadata?.display_name as string | undefined
    return (
        <div ref={ref} className='relative'>
            <button aria-label='Профіль' onClick={() => setOpen((v) => !v)}
                    className='grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink hover:bg-page'>
                <LuUser size={19}/>
            </button>
            {open && (
                <div className='absolute right-0 top-12 z-[1300] w-60 rounded-2xl border border-line bg-white p-2 shadow-xl'>
                    {session ? (
                        <>
                            <div className='px-3 py-2'>
                                <p className='truncate font-semibold'>{name || 'Мій профіль'}</p>
                                <p className='truncate text-xs text-muted'>{session.user.email}</p>
                            </div>
                            <Link to='/settings/sos' onClick={() => setOpen(false)}
                                  className='block rounded-xl px-3 py-2 text-sm hover:bg-page'>Екстрений контакт (SOS)</Link>
                            <Link to='/map/editor' onClick={() => setOpen(false)}
                                  className='block rounded-xl px-3 py-2 text-sm hover:bg-page'>Додати позначку</Link>
                            <button onClick={async () => { await signOut(); setOpen(false); navigate('/map') }}
                                    className='flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-sos hover:bg-sos-soft'>
                                <LuLogOut size={16}/> Вийти
                            </button>
                        </>
                    ) : (
                        <div className='flex flex-col gap-1.5 p-1'>
                            <p className='px-2 pb-1 text-sm text-muted'>Увійдіть, щоб додавати позначки й писати нотатки.</p>
                            <Link to='/login' onClick={() => setOpen(false)}
                                  className='rounded-xl bg-brand px-3 py-2 text-center text-sm font-semibold text-white'>Увійти</Link>
                            <Link to='/register' onClick={() => setOpen(false)}
                                  className='rounded-xl border border-line px-3 py-2 text-center text-sm font-semibold'>Зареєструватися</Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export const SosButton = ({className = ''}: { className?: string }) => (
    <Link to='/settings/sos'
          className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-sos px-4 py-2 text-sm font-bold text-sos hover:bg-sos-soft ${className}`}>
        <LuSiren size={16}/> SOS
    </Link>
)

// Нижні вкладки на телефоні
const TABS = [
    {to: '/map', label: 'Карта', icon: LuMap},
    {to: '/route', label: 'Навігатор', icon: LuNavigation},
    {to: '/live', label: 'Наживо', icon: LuActivity},
    {to: '/profile', label: 'Профіль', icon: LuUser},
]

export const MobileTabBar = () => (
    <nav className='fixed inset-x-0 bottom-0 z-[1200] flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden'>
        {TABS.map(({to, label, icon: Icon}) => (
            <NavLink key={to} to={to} end={to === '/map'}
                     className={({isActive}) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}>
                {({isActive}) => (<><Icon size={21} strokeWidth={isActive ? 2.4 : 1.8}/>{label}</>)}
            </NavLink>
        ))}
    </nav>
)

// Шапка сайту. На телефоні замість неї нижні вкладки; mobileBar=false ховає й верхню смужку
// (сторінки з картою на весь екран мають власні плаваючі елементи).
export const NavBar = ({mobileBar = true}: { mobileBar?: boolean }) => (
    <>
        <header className={`relative z-[1200] h-16 shrink-0 items-center justify-between border-b border-line bg-white px-4 md:flex md:px-7 ${mobileBar ? 'flex' : 'hidden'}`}>
            <Logo/>
            <nav className='hidden items-center gap-1 md:flex'>
                {NAV_LINKS.map((l) => (
                    <NavLink key={l.to} to={l.to} end
                             className={({isActive}) => `rounded-full px-4 py-2 text-[15px] font-medium transition-colors ${isActive ? 'bg-brand-soft font-semibold text-brand' : 'text-ink hover:bg-page'}`}>
                        {l.label}
                    </NavLink>
                ))}
            </nav>
            <div className='flex items-center gap-2.5'>
                <span className='hidden md:block'><DemoToggle/></span>
                <SosButton/>
                <ProfileMenu/>
            </div>
        </header>
        <MobileTabBar/>
    </>
)
