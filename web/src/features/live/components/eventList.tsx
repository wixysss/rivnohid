import type {LiveEvent} from "../liveStore.ts";
import {LEVELS} from "../constants.ts";

export const EventList = ({events}: { events: LiveEvent[] }) => {
    if (!events.length) {
        return <p className='text-sm text-zinc-500'>Поки що рівно. Ями й мітки з кнопки з'являться тут.</p>
    }
    return (
        <ul className='max-h-56 overflow-auto divide-y divide-zinc-100'>
            {events.map((e) => (
                <li key={e.id} className='flex items-center gap-3 py-2 text-sm'>
                    <span className='w-16 shrink-0 tabular-nums text-zinc-500'>{e.time.toLocaleTimeString('uk-UA')}</span>
                    <span className='rounded-full px-2 py-0.5 text-xs text-white'
                          style={{background: e.kind === 'bump' ? LEVELS.bad.color : '#2a78d6'}}>
                        {e.kind === 'bump' ? 'Яма' : 'Перешкода'}
                    </span>
                    <span className='truncate'>
                        {e.peak.toFixed(2)} g · {e.lat != null && e.lon != null ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}` : 'без GPS'}
                    </span>
                </li>
            ))}
        </ul>
    )
}
