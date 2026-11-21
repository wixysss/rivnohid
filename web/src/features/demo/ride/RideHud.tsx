import {LuCrosshair, LuPause, LuPlay, LuRotateCcw, LuX} from "react-icons/lu";
import {ridePause, rideSetFollow, rideSetMul, rideStop, useRide} from "./rideStore.ts";

const SPEEDS = [4, 8, 16]
const STATUS = {
    off: '', running: 'Їде', paused: 'Пауза', rerouting: "Шукає об'їзд…", done: 'Прибули',
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const m = (x: number) => x < 1000 ? `${Math.round(x)} м` : `${(x / 1000).toFixed(1).replace('.', ',')} км`
const TONE = {info: 'bg-[#c4c8c2]', warn: 'bg-lvl-uneven', ok: 'bg-brand'}

const Stat = ({label, value}: { label: string, value: string }) => (
    <div className='min-w-0'>
        <div className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted'>{label}</div>
        <div className='truncate text-[17px] font-bold tabular-nums leading-tight'>{value}</div>
    </div>
)

// Панель демо-поїздки над картою
export const RideHud = ({onRestart}: { onRestart: () => void }) => {
    const s = useRide()
    if (s.status === 'off') return null
    const left = Math.max(0, s.total - s.dist)
    const progress = s.travelled / Math.max(1, s.travelled + left)

    return (
        <div className='absolute left-3 right-[64px] top-3 z-[1000] rounded-2xl border border-line bg-white/95 p-3 md:p-3.5 shadow-lg backdrop-blur md:left-3 md:right-auto md:w-[320px]'>
            <div className='flex items-center gap-2'>
                <span className='rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand'>Демо</span>
                <span className='font-bold'>Поїздка</span>
                <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-semibold ${s.status === 'rerouting' ? 'text-[#8a5a00]' : 'text-muted'}`}>
                    <i className={`inline-block h-2 w-2 rounded-full ${s.status === 'running' ? 'animate-pulse bg-[#22a35a]' : s.status === 'rerouting' ? 'animate-pulse bg-lvl-uneven' : s.status === 'done' ? 'bg-brand' : 'bg-faint'}`}/>
                    {STATUS[s.status]}
                </span>
                <button aria-label='Завершити демо-поїздку' onClick={rideStop} className='-mr-1 grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-page'><LuX size={17}/></button>
            </div>

            <div className='mt-2.5 h-1.5 overflow-hidden rounded-full bg-page'>
                <div className='h-full rounded-full bg-[#1f6fe5] transition-[width] duration-200' style={{width: `${Math.round(progress * 100)}%`}}/>
            </div>

            <div className='mt-2.5 grid grid-cols-4 gap-2'>
                <Stat label='Час' value={clock(s.elapsed)}/>
                <Stat label='Лишилось' value={m(left)}/>
                <Stat label='км/год' value={(s.speed * 3.6).toFixed(1).replace('.', ',')}/>
                <Stat label='Ям оминуто' value={String(s.avoided)}/>
            </div>

            <div className='mt-3 flex items-center gap-1.5'>
                {s.status === 'done' ? (
                    <button onClick={onRestart} className='inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-semibold text-white'>
                        <LuRotateCcw size={15}/> Ще раз
                    </button>
                ) : (
                    <button onClick={ridePause} aria-label={s.status === 'paused' ? 'Продовжити' : 'Пауза'}
                            className='grid h-9 w-9 place-items-center rounded-xl bg-brand text-white'>
                        {s.status === 'paused' ? <LuPlay size={16}/> : <LuPause size={16}/>}
                    </button>
                )}
                <div className='flex rounded-xl bg-page p-0.5'>
                    {SPEEDS.map((x) => (
                        <button key={x} onClick={() => rideSetMul(x)}
                                className={`h-8 rounded-[10px] px-2.5 text-sm font-semibold tabular-nums ${s.mul === x ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}>×{x}</button>
                    ))}
                </div>
                <button onClick={() => rideSetFollow(!s.follow)} aria-pressed={s.follow}
                        className={`ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold ${s.follow ? 'bg-brand-soft text-brand' : 'border border-line text-muted'}`}>
                    <LuCrosshair size={15}/><span className="hidden sm:inline">Стежити</span>
                </button>
            </div>

            {s.log.length > 0 && (
                <ul className='mt-3 space-y-1 border-t border-line pt-2.5 text-[13px]'>
                    {s.log.slice(0, 3).map((l, i) => (
                        <li key={`${l.t}-${i}`} className={`flex items-start gap-2 ${i ? 'text-muted' : 'font-medium text-ink'}`}>
                            <i className={`mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${TONE[l.tone]}`}/>
                            <span className='w-9 shrink-0 tabular-nums text-faint'>{clock(l.t)}</span>
                            <span className='min-w-0'>{l.text}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
