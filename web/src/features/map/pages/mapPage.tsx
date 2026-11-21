import {useCallback, useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Marker} from "react-leaflet";
import type L from "leaflet";
import {LuPlus, LuSiren, LuUser} from "react-icons/lu";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {AddressSearch} from "../../../shared/components/addressSearch.tsx";
import {type MarkerRow, MapView} from "../components/mapView.tsx";
import {useMarkers} from "../hooks/useMarkers.ts";
import {useMarkerTypes} from "../hooks/useMarkerTypes.ts";
import {useDevicePosition} from "../../live/hooks/useDevicePosition.ts";
import {DevicePositionMarker} from "../../live/components/devicePositionMarker.tsx";
import {createDotIcon} from "../markerStyles.ts";
import {LEVEL_META, SEVERITY_LEVEL, SEVERITY_ORDER, type Severity} from "../../../shared/ui/levels.ts";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";
import {Check, CheckRow} from "../../../shared/ui/checkbox.tsx";
import {btn} from "../../../shared/ui/card.tsx";
import type {Place} from "../../../shared/lib/geocode.ts";
import {DemoNotice, DemoToggle} from "../../../shared/components/demoToggle.tsx";

const PERIODS = [
    {days: 0, label: 'Увесь час'},
    {days: 7, label: 'Останні 7 днів'},
    {days: 30, label: 'Останні 30 днів'},
    {days: 90, label: 'Останні 3 місяці'},
]

export const MapPage = () => {
    const navigate = useNavigate()
    const device = useDevicePosition()
    const {data: markers} = useMarkers()
    const {data: types} = useMarkerTypes()

    const [map, setMap] = useState<L.Map | null>(null)
    const [sev, setSev] = useState<Set<string>>(() => new Set(SEVERITY_ORDER))
    const [hiddenTypes, setHiddenTypes] = useState<Set<number>>(() => new Set())
    const [period, setPeriod] = useState(0)
    const [showTrack, setShowTrack] = useState(true)
    const [showVoice, setShowVoice] = useState(true)
    const [found, setFound] = useState<Place | null>(null)

    const inPeriod = useCallback((m: MarkerRow) => !period || Date.now() - Date.parse(m.created_at) < period * 864e5, [period])
    const typeOk = useCallback((m: MarkerRow) => !hiddenTypes.has(m.type_id), [hiddenTypes])
    const filter = useCallback((m: MarkerRow) => sev.has(m.severity) && typeOk(m) && inPeriod(m), [sev, typeOk, inPeriod])

    const counts = useMemo(() => {
        const c: Record<string, number> = {ok: 0, warning: 0, bad: 0}
        for (const m of markers ?? []) if (typeOk(m) && inPeriod(m)) c[m.severity] = (c[m.severity] ?? 0) + 1
        return c
    }, [markers, typeOk, inPeriod])

    const toggle = <T, >(set: Set<T>, v: T) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n }
    const goTo = (p: Place) => { setFound(p); map?.flyTo([p.lat, p.lng], 17) }
    const center = map ? {lat: map.getCenter().lat, lng: map.getCenter().lng} : undefined

    return (
        <div className='flex h-dvh flex-col'>
            <NavBar mobileBar={false}/>
            <div className='flex min-h-0 flex-1'>
                {/* Бічна панель (комп'ютер) */}
                <aside className='hidden w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-white p-[18px] md:flex'>
                    <AddressSearch onSelect={goTo} onClear={() => setFound(null)} near={center}/>

                    <section>
                        <h2 className='rv-label mb-2.5'>Стан дороги</h2>
                        <div className='flex flex-col gap-1.5'>
                            {SEVERITY_ORDER.map((s: Severity) => {
                                const m = LEVEL_META[SEVERITY_LEVEL[s]]
                                const on = sev.has(s)
                                return (
                                    <label key={s} style={on ? {background: m.soft} : undefined}
                                           className={`flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 ${on ? '' : 'bg-page/60 opacity-60'}`}>
                                        <input type='checkbox' className='sr-only' checked={on} onChange={() => setSev(toggle(sev, s))}/>
                                        <Check checked={on}/>
                                        <LevelIcon level={SEVERITY_LEVEL[s]} size={15}/>
                                        <span className='flex-1 text-[15px] font-semibold' style={{color: m.text}}>{m.label}</span>
                                        <span className='text-sm font-semibold tabular-nums' style={{color: m.text}}>{counts[s] ?? 0}</span>
                                    </label>
                                )
                            })}
                        </div>
                        <p className='mt-2.5 text-xs leading-relaxed text-muted'>
                            Стан показує і колір, і форма маркера, тож карту видно й без розрізнення кольорів.
                        </p>
                    </section>

                    {types && types.length > 0 && (
                        <section>
                            <h2 className='rv-label mb-2.5'>Тип проблеми</h2>
                            <div className='grid grid-cols-2 gap-x-3 gap-y-2.5'>
                                {types.map((t) => (
                                    <CheckRow key={t.id} checked={!hiddenTypes.has(t.id)} onChange={() => setHiddenTypes(toggle(hiddenTypes, t.id))}>
                                        <span className='leading-tight'>{t.label}</span>
                                    </CheckRow>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h2 className='rv-label mb-2.5'>Період</h2>
                        <select value={period} onChange={(e) => setPeriod(+e.target.value)}
                                className='w-full cursor-pointer rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand'>
                            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                        </select>
                    </section>

                    <section className='flex flex-col gap-2.5'>
                        <h2 className='rv-label'>На карті</h2>
                        <CheckRow checked={showTrack} onChange={setShowTrack}>Обстежені пристроєм дороги</CheckRow>
                        <CheckRow checked={showVoice} onChange={setShowVoice}>Голосові нотатки</CheckRow>
                    </section>

                    <button className={`${btn.primary} mt-auto w-full py-3`} onClick={() => navigate('/map/editor')}>
                        <LuPlus size={18}/> Додати точку
                    </button>
                </aside>

                {/* Карта */}
                <div className='relative min-w-0 flex-1 pb-[62px] md:pb-0'>
                    <MapView filter={filter} showTrack={showTrack} showVoice={showVoice} onReady={setMap}>
                        {found && <Marker position={[found.lat, found.lng]} icon={createDotIcon('#173d33')}/>}
                        <DevicePositionMarker pos={device.pos}/>
                    </MapView>

                    {/* Телефон: пошук, фільтри-чипси, SOS поверх карти */}
                    <div className='pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2.5 p-3 pr-16 md:hidden'>
                        <AddressSearch className='pointer-events-auto shadow-md' onSelect={goTo} onClear={() => setFound(null)} near={center}
                                       right={<Link to='/profile' aria-label='Профіль' className='-mr-1.5 grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand'><LuUser size={17}/></Link>}/>
                        <div className='pointer-events-auto -mr-16 flex gap-2 overflow-x-auto pb-1'>
                            {SEVERITY_ORDER.map((s) => {
                                const m = LEVEL_META[SEVERITY_LEVEL[s]]
                                const on = sev.has(s)
                                return (
                                    <button key={s} onClick={() => setSev(toggle(sev, s))}
                                            className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] bg-white px-3.5 py-1.5 text-sm font-semibold shadow-sm ${on ? '' : 'opacity-50'}`}
                                            style={{borderColor: on ? m.color : '#e2e3dd', color: m.text}}>
                                        <LevelIcon level={SEVERITY_LEVEL[s]} size={12}/>{m.label}
                                    </button>
                                )
                            })}
                            <DemoToggle className='shadow-sm'/>
                        </div>
                    </div>
                    <DemoNotice className='absolute bottom-[150px] left-1/2 z-[1000] max-w-[calc(100%-24px)] -translate-x-1/2 md:bottom-6'
                                onFind={device.pos ? () => map?.flyTo([device.pos!.lat, device.pos!.lng], 17) : undefined}/>
                    <Link to='/settings/sos'
                          className='absolute bottom-[88px] left-3 z-[1000] inline-flex items-center gap-2 rounded-full bg-sos px-5 py-3 font-bold text-white shadow-lg md:hidden'>
                        <LuSiren size={19}/> SOS
                    </Link>
                </div>
            </div>
        </div>
    )
}
