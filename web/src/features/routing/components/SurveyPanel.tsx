import {useMemo} from "react";
import {useDeviceTrack} from "../../track/hooks/useDeviceTrack.ts";
import {LEVEL_COLOR, LEVEL_LABEL, type RoadLevel, toRuns, trackStats} from "../../track/lib/segments.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import type {DevicePosition} from "../../live/hooks/useDevicePosition.ts";
import type {Point} from "../../map/types.ts";

type Props = {
    device: { pos: DevicePosition | null, online: boolean }
    onStartHere: (p: Point) => void
}

const LEVELS: RoadLevel[] = ['ok', 'warning', 'bad']

// Що обстежив пристрій: кілометри доріг за станом, точки з нотатками, де пристрій зараз
export const SurveyPanel = ({device, onStartHere}: Props) => {
    const {data: track} = useDeviceTrack()
    const {data: markers} = useMarkers()
    const stats = useMemo(() => trackStats(toRuns(track ?? [])), [track])
    const points = (markers ?? []).filter((m) => m.source === 'device' && m.marker_types?.slug === 'point')
    const withVoice = points.filter((m) => (m.voice_notes?.length ?? 0) > 0).length
    const withText = points.filter((m) => m.description).length

    return (
        <section className='mt-3 border-t border-gray-200 pt-3 text-sm'>
            <h2 className='mb-2 font-medium text-gray-900'>Обстежено пристроєм</h2>

            <div className='mb-2 flex items-center gap-2 text-xs text-gray-600'>
                <i className={`inline-block h-2.5 w-2.5 rounded-full ${device.pos ? 'bg-green-500 animate-pulse' : device.online ? 'bg-yellow-400' : 'bg-gray-300'}`}/>
                {device.pos ? 'Пристрій онлайн, GPS є' : device.online ? 'Пристрій онлайн, чекає GPS' : 'Пристрій не на зв\'язку'}
            </div>
            {device.pos && (
                <button onClick={() => onStartHere({lat: device.pos!.lat, lng: device.pos!.lng})}
                        className='mb-3 w-full rounded-lg border border-blue-600 py-1.5 text-blue-700 hover:bg-blue-50'>
                    Точка А — де пристрій
                </button>
            )}

            {stats.total > 0 ? (
                <>
                    <div className='mb-1 flex h-2 overflow-hidden rounded-full bg-gray-100'>
                        {LEVELS.map((l) => (
                            <span key={l} style={{width: `${stats[l] / stats.total * 100}%`, background: LEVEL_COLOR[l]}}/>
                        ))}
                    </div>
                    <ul className='mb-2 space-y-0.5'>
                        {LEVELS.map((l) => (
                            <li key={l} className='flex items-center justify-between text-xs text-gray-600'>
                                <span className='flex items-center gap-1.5'>
                                    <i className='inline-block h-1.5 w-4 rounded' style={{background: LEVEL_COLOR[l]}}/>{LEVEL_LABEL[l]}
                                </span>
                                <span className='tabular-nums'>{stats[l].toFixed(2)} км</span>
                            </li>
                        ))}
                    </ul>
                    <p className='text-xs text-gray-500'>Разом {stats.total.toFixed(2)} км. Погані ділянки підвищують штраф маршруту.</p>
                </>
            ) : (
                <p className='rounded-lg bg-gray-50 p-2 text-xs text-gray-500'>
                    Ще немає треку. Увімкни пристрій на вулиці: з GPS він сам малює дороги кольором стану покриття.
                </p>
            )}

            <p className='mt-2 text-xs text-gray-600'>
                Точок: <b>{points.length}</b>{points.length > 0 && <> · з голосом {withVoice} · з текстом {withText}</>}
            </p>
            <p className='mt-1 text-xs text-gray-400'>Кнопка 3 на пристрої ставить точку, кнопка 1 додає до неї голос. Текст пишеться в точці на карті.</p>
        </section>
    )
}
