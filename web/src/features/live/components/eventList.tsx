import {useState} from "react";
import type {LiveEvent} from "../liveStore.ts";
import {LEVELS} from "../constants.ts";
import {VoicePlayer} from "../../voice/components/voicePlayer.tsx";
import {formatDuration} from "../../voice/requests.ts";

const KIND: Record<LiveEvent['kind'], { label: string, color: string }> = {
    bump: {label: 'Яма', color: LEVELS.bad.color},
    mark: {label: 'Перешкода', color: '#2a78d6'},
    voice: {label: 'Нотатка', color: '#2a78d6'},
    sos: {label: 'SOS', color: '#dc2626'},
    marker: {label: 'Позначка', color: '#71717a'},
    point: {label: 'Точка', color: '#7c3aed'},
}

const SEV: Record<string, string> = {ok: 'рівно', warning: 'нерівно', bad: 'погано'}

const where = (e: LiveEvent) => e.lat != null && e.lon != null ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}` : 'без GPS'

export const EventList = ({events}: { events: LiveEvent[] }) => {
    const [open, setOpen] = useState<string | null>(null)
    if (!events.length) {
        return <p className='text-sm text-zinc-500'>Поки що рівно. Ями, голосові нотатки й SOS з'являться тут.</p>
    }
    return (
        <ul className='max-h-72 overflow-auto divide-y divide-zinc-100'>
            {events.map((e) => (
                <li key={e.id} className='py-2 text-sm'>
                    <div className='flex items-center gap-3'>
                        <span className='w-16 shrink-0 tabular-nums text-zinc-500'>{e.time.toLocaleTimeString('uk-UA')}</span>
                        <span className='rounded-full px-2 py-0.5 text-xs text-white' style={{background: KIND[e.kind].color}}>
                            {KIND[e.kind].label}
                        </span>
                        <span className='truncate'>
                            {e.kind === 'voice' ? `${formatDuration(e.durMs ?? null)} · ${where(e)}`
                                : e.kind === 'point' ? `№${e.pointN} · ${SEV[e.sev ?? 'ok']} · ${e.sent ? 'на карті' : 'надсилається…'}`
                                : e.kind === 'sos' ? where(e)
                                    : `${e.peak.toFixed(2)} g · ${where(e)}`}
                        </span>
                        {e.kind === 'voice' && e.noteId && (
                            <button className='ml-auto shrink-0 text-[#2a78d6]'
                                    onClick={() => setOpen(open === e.noteId ? null : e.noteId!)}>
                                {open === e.noteId ? 'Сховати' : 'Слухати'}
                            </button>
                        )}
                    </div>
                    {e.kind === 'voice' && e.noteId && open === e.noteId && (
                        <div className='mt-2'><VoicePlayer id={e.noteId}/></div>
                    )}
                </li>
            ))}
        </ul>
    )
}
