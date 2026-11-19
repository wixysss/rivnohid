import {useMemo} from "react";
import {useDeviceTrack} from "../../track/hooks/useDeviceTrack.ts";
import {LEVEL_COLOR, LEVEL_LABEL, toRuns, trackStats} from "../../track/lib/segments.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import type {DevicePosition} from "../../live/hooks/useDevicePosition.ts";
import type {Point} from "../../map/types.ts";
import {LEVEL_ORDER} from "../../../shared/ui/levels.ts";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";

type Props = {
    device: { pos: DevicePosition | null, online: boolean }
    onStartHere: (p: Point) => void
}

const km = (v: number) => v.toFixed(2).replace('.', ',')

// Що обстежив пристрій: кілометри доріг за станом, точки з нотатками, де пристрій зараз
export const SurveyPanel = ({device, onStartHere}: Props) => {
    const {data: track} = useDeviceTrack()
    const {data: markers} = useMarkers()
    const stats = useMemo(() => trackStats(toRuns(track ?? [])), [track])
    const points = (markers ?? []).filter((m) => m.source === 'device' && m.marker_types?.slug === 'point')
    const withVoice = points.filter((m) => (m.voice_notes?.length ?? 0) > 0).length

    return (
        <section className='rounded-2xl border border-line bg-page/50 p-4 text-sm'>
            <div className='mb-3 flex items-center justify-between gap-2'>
                <h2 className='rv-label'>Обстежено пристроєм</h2>
                <span className='flex items-center gap-1.5 text-xs text-muted'>
                    <i className={`inline-block h-2 w-2 rounded-full ${device.pos ? 'animate-pulse bg-[#22a35a]' : device.online ? 'bg-lvl-uneven' : 'bg-[#c4c8c2]'}`}/>
                    {device.pos ? 'онлайн, GPS є' : device.online ? 'онлайн, без GPS' : 'не на зв\'язку'}
                </span>
            </div>

            {stats.total > 0 ? (
                <>
                    <div className='mb-2.5 flex h-2 overflow-hidden rounded-full bg-[#e7e9e4]'>
                        {LEVEL_ORDER.map((l) => <span key={l} style={{width: `${stats[l] / stats.total * 100}%`, background: LEVEL_COLOR[l]}}/>)}
                    </div>
                    <ul className='mb-2 grid grid-cols-2 gap-x-3 gap-y-1'>
                        {LEVEL_ORDER.map((l) => (
                            <li key={l} className='flex items-center gap-1.5 text-xs text-muted'>
                                <LevelIcon level={l} size={10}/>{LEVEL_LABEL[l]}
                                <span className='ml-auto font-semibold tabular-nums text-ink'>{km(stats[l])}</span>
                            </li>
                        ))}
                    </ul>
                    <p className='text-xs text-muted'>Разом {km(stats.total)} км. Погані ділянки підвищують штраф маршруту.</p>
                </>
            ) : (
                <p className='text-xs leading-relaxed text-muted'>
                    Треку ще немає. Увімкніть на пристрої запис маршруту (кнопка 2): з GPS він сам малює дороги кольором стану покриття.
                </p>
            )}

            <p className='mt-2.5 text-xs text-muted'>
                Точок з пристрою: <b className='text-ink'>{points.length}</b>{withVoice > 0 && <>, з голосом {withVoice}</>}
            </p>
            {device.pos && (
                <button onClick={() => onStartHere({lat: device.pos!.lat, lng: device.pos!.lng})}
                        className='mt-3 w-full rounded-xl border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand-soft'>
                    Точка А — де пристрій
                </button>
            )}
        </section>
    )
}
