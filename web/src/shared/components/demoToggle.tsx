import {LuFlaskConical} from "react-icons/lu";
import {useDemo} from "../../features/demo/demoStore.ts";

const Switch = ({on}: { on: boolean }) => (
    <span className={`relative inline-block h-[18px] w-8 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-[#c9cdc6]'}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[16px]' : 'left-[2px]'}`}/>
    </span>
)

// Перемикач демо-режиму на весь сайт: вигадані ями, трек і пристрій, що їздить центром Житомира
export const DemoToggle = ({className = ''}: { className?: string }) => {
    const {on, toggle} = useDemo()
    return (
        <button onClick={toggle} aria-pressed={on} title='Демо-дані: вигадані ями, трек і пристрій, що їздить центром Житомира'
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-muted hover:bg-page'} ${className}`}>
            <LuFlaskConical size={15}/> Демо <Switch on={on}/>
        </button>
    )
}

// Рядок для профілю / бічних панелей
export const DemoRow = ({className = ''}: { className?: string }) => {
    const {on, toggle} = useDemo()
    return (
        <button onClick={toggle} aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left ${className}`}>
            <LuFlaskConical size={20} className='text-brand'/>
            <span className='min-w-0 flex-1'>
                <span className='block font-medium'>Демо-режим</span>
                <span className='block text-xs text-muted'>Вигадані ями, трек і пристрій на всіх вкладках, щоб показати сайт без заліза</span>
            </span>
            <Switch on={on}/>
        </button>
    )
}

// Плашка над картою в демо-режимі: що тут вигадане і як знайти «пристрій»
export const DemoNotice = ({onFind, className = ''}: { onFind?: () => void, className?: string }) => {
    const {on, setOn} = useDemo()
    if (!on) return null
    return (
        <div className={`flex items-center gap-2 rounded-full border border-brand/30 bg-white/95 py-1.5 pl-3.5 pr-1.5 text-sm shadow-lg backdrop-blur ${className}`}>
            <LuFlaskConical size={15} className='shrink-0 text-brand'/>
            <span className='min-w-0 truncate'><b className='text-brand'>Демо-дані</b><span className='hidden text-muted sm:inline'> · ями, трек і пристрій вигадані</span></span>
            {onFind && <button onClick={onFind} className='shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white'>Де пристрій</button>}
            <button onClick={() => setOn(false)} className='shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-muted hover:bg-page'>Вимкнути</button>
        </div>
    )
}
