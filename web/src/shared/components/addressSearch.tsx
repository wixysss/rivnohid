import {type ReactNode, useEffect, useRef, useState} from "react";
import {LuMapPin, LuSearch, LuX} from "react-icons/lu";
import {type Place, searchPlaces} from "../lib/geocode.ts";

type Props = {
    placeholder?: string
    value?: string                       // текст, коли місце вже вибрано (напр. «Моє місцезнаходження»)
    onSelect: (p: Place) => void
    onClear?: () => void
    near?: { lat: number, lng: number }
    icon?: boolean
    right?: ReactNode
    className?: string
}

// Поле пошуку адреси з підказками
export const AddressSearch = ({placeholder = 'Пошук адреси або місця', value, onSelect, onClear, near, icon = true, right, className = ''}: Props) => {
    const [q, setQ] = useState(value ?? '')
    const [items, setItems] = useState<Place[]>([])
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const typed = useRef(false)
    const box = useRef<HTMLDivElement>(null)

    useEffect(() => { setQ(value ?? ''); typed.current = false }, [value])

    // Підказки через 0.6 с після останнього символу (правила Nominatim: не частіше 1 запиту/с)
    useEffect(() => {
        if (!typed.current || q.trim().length < 3) { setItems([]); return }
        const ctl = new AbortController()
        const t = setTimeout(() => {
            setBusy(true); setErr('')
            searchPlaces(q.trim(), ctl.signal, near)
                .then((r) => { setItems(r); setOpen(true); if (!r.length) setErr('Нічого не знайдено') })
                .catch((e: unknown) => { if (!ctl.signal.aborted) setErr(e instanceof Error ? e.message : 'Помилка') })
                .finally(() => setBusy(false))
        }, 600)
        return () => { clearTimeout(t); ctl.abort() }
    }, [q])

    useEffect(() => {
        if (!open) return
        const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [open])

    const pick = (p: Place) => {
        typed.current = false
        setQ(p.short); setItems([]); setOpen(false)
        onSelect(p)
    }

    return (
        <div ref={box} className={`relative ${className}`}>
            <div className='flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15'>
                {icon && <LuSearch className='shrink-0 text-muted' size={18}/>}
                <input value={q} placeholder={placeholder}
                       onChange={(e) => { typed.current = true; setQ(e.target.value) }}
                       onFocus={() => items.length && setOpen(true)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && items[0]) pick(items[0]) }}
                       className='min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-faint'/>
                {busy && <span className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand'/>}
                {q && !busy && onClear && (
                    <button aria-label='Очистити' onClick={() => { setQ(''); setItems([]); onClear() }} className='text-faint hover:text-ink'>
                        <LuX size={17}/>
                    </button>
                )}
                {right}
            </div>
            {open && (items.length > 0 || err) && (
                <ul className='absolute inset-x-0 top-[calc(100%+6px)] z-[1300] max-h-72 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl'>
                    {err && !items.length && <li className='px-3 py-2 text-sm text-muted'>{err}</li>}
                    {items.map((p, i) => (
                        <li key={i}>
                            <button onClick={() => pick(p)} className='flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-page'>
                                <LuMapPin className='mt-0.5 shrink-0 text-muted' size={16}/>
                                <span className='min-w-0'>
                                    <span className='block truncate text-sm font-medium'>{p.short}</span>
                                    <span className='block truncate text-xs text-muted'>{p.label}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
