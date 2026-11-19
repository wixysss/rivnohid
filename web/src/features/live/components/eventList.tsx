import {useState} from "react";
import {LuFlag, LuMic, LuSiren} from "react-icons/lu";
import type {LiveEvent} from "../liveStore.ts";
import {levelOfPeak} from "../constants.ts";
import {VoicePlayer} from "../../voice/components/voicePlayer.tsx";
import {formatDuration} from "../../voice/requests.ts";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";
import {levelOfSeverity} from "../../../shared/ui/levels.ts";

const g = (v: number) => v.toFixed(2).replace('.', ',')
const where = (e: LiveEvent) => e.lat != null && e.lon != null ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}` : 'без GPS'
const ago = (t: Date) => {
    const s = Math.round((Date.now() - t.getTime()) / 1000)
    return s < 30 ? 'щойно' : s < 3600 ? `${Math.max(1, Math.round(s / 60))} хв тому` : t.toLocaleTimeString('uk-UA', {hour: '2-digit', minute: '2-digit'})
}

const Row = ({e}: { e: LiveEvent }) => {
    const [open, setOpen] = useState(false)
    const icon = e.kind === 'voice' ? <LuMic size={17} className='text-ink'/>
        : e.kind === 'sos' ? <LuSiren size={17} className='text-sos'/>
            : e.kind === 'point' ? <LevelIcon level={levelOfSeverity(e.sev ?? 'ok')} size={15}/>
                : e.kind === 'bump' ? <LevelIcon level={levelOfPeak(e.peak)} size={15}/>
                    : <LuFlag size={16} className='text-muted'/>
    const title = e.kind === 'voice' ? 'Голосова нотатка'
        : e.kind === 'sos' ? 'SOS'
            : e.kind === 'point' ? `Точка №${e.pointN}`
                : e.kind === 'bump' ? `${e.peak >= 0.35 ? 'Яма' : 'Нерівність'} · ${g(e.peak)} G`
                    : 'Позначка'
    const sub = e.kind === 'voice' ? `${formatDuration(e.durMs ?? null)} · ${where(e)}`
        : e.kind === 'point' ? (e.sent ? 'на карті' : 'надсилається…')
            : where(e)

    return (
        <li className='border-t border-line py-3 first:border-t-0 first:pt-0'>
            <div className='flex items-start gap-3'>
                <span className='mt-0.5 grid w-5 place-items-center'>{icon}</span>
                <div className='min-w-0 flex-1'>
                    <p className='text-[15px] font-semibold'>{title}</p>
                    <p className='truncate text-xs text-muted'>{sub}</p>
                    {e.kind === 'voice' && e.noteId && (
                        <button className='mt-1 text-xs font-semibold text-brand' onClick={() => setOpen(!open)}>{open ? 'Сховати' : 'Слухати'}</button>
                    )}
                </div>
                <span className='whitespace-nowrap text-xs text-muted'>{ago(e.time)}</span>
            </div>
            {open && e.noteId && <div className='mt-2 pl-8'><VoicePlayer id={e.noteId}/></div>}
        </li>
    )
}

export const EventList = ({events}: { events: LiveEvent[] }) => {
    if (!events.length) return <p className='text-sm text-muted'>Поки що рівно. Ями, голосові нотатки, точки й SOS з'являться тут.</p>
    return <ul className='max-h-80 overflow-auto'>{events.map((e) => <Row key={e.id} e={e}/>)}</ul>
}
