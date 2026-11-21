import {useEffect, useMemo, useState} from "react";
import {Marker} from "react-leaflet";
import type L from "leaflet";
import {LuArrowUpDown, LuChevronDown, LuChevronUp, LuLocateFixed, LuPlay, LuSparkles} from "react-icons/lu";
import {useRoutePoints} from "../hooks/useRoutePoints.ts";
import {useRankedRoutes} from "../hooks/useRankedRoutes.ts";
import {MapView} from "../../map/components/mapView.tsx";
import {ClickLayer} from "../../map/components/clickLayer.tsx";
import {createPinIcon} from "../../map/markerStyles.ts";
import {RoutesLayer} from "../components/RoutesLayer.tsx";
import {RouteSummary} from "../components/RouteSummary.tsx";
import {RouteVariants} from "../components/RouteVariants.tsx";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {AddressSearch} from "../../../shared/components/addressSearch.tsx";
import {SurveyPanel} from "../components/SurveyPanel.tsx";
import {useDevicePosition} from "../../live/hooks/useDevicePosition.ts";
import {DevicePositionMarker} from "../../live/components/devicePositionMarker.tsx";
import {MOVERS, type MoverId} from "../profiles.ts";
import {fmtKm, fmtMin, toVariants} from "../lib/variants.ts";
import {useIsMobile} from "../../../shared/lib/useIsMobile.ts";
import {myLocation} from "../../../shared/lib/geocode.ts";
import {useMarkers} from "../../map/hooks/useMarkers.ts";
import {RideLayer} from "../../demo/ride/RideLayer.tsx";
import {RideHud} from "../../demo/ride/RideHud.tsx";
import {rideStart, rideStop, useRide} from "../../demo/ride/rideStore.ts";
import {DemoRow} from "../../../shared/components/demoToggle.tsx";

// Приклад маршруту для демо: центр Житомира
const EXAMPLE = {a: {lat: 50.25440, lng: 28.65800}, b: {lat: 50.26280, lng: 28.67420}}

export const RoutePage = () => {
    const {from, to, setFrom, setTo, clearFrom, clearTo, pick, swap, example} = useRoutePoints()
    const [moverId, setMoverId] = useState<MoverId>('wheelchair')
    const mover = MOVERS.find((m) => m.id === moverId) ?? MOVERS[0]
    const {routes, isLoading, error} = useRankedRoutes(from, to, mover)
    const variants = useMemo(() => toVariants(routes ?? []), [routes])
    const [selected, setSelected] = useState<number | null>(null)
    const [map, setMap] = useState<L.Map | null>(null)
    const [locErr, setLocErr] = useState('')
    const device = useDevicePosition()
    const mobile = useIsMobile()
    // Телефон: панель знизу або розгорнута, або згорнута до рядка з підсумком, щоб карту було видно
    const [open, setOpen] = useState(true)
    const PEEK = 112
    const {data: markers} = useMarkers()
    const riding = useRide((s) => s.status !== 'off')

    // Новий набір маршрутів — обираємо рекомендований і показуємо весь маршрут
    useEffect(() => {
        setSelected(variants[0]?.id ?? null)
        if (variants.length) setOpen(false)
        if (map && variants.length && useRide.getState().status === 'off') {
            const wide = window.innerWidth >= 768     // на комп'ютері зліва вгорі картка-підсумок, на телефоні знизу згорнута панель
            map.fitBounds(variants.flatMap((v) => v.path.map((p) => [p.lat, p.lng] as [number, number])),
                wide ? {paddingTopLeft: [290, 60], paddingBottomRight: [80, 40]} : {paddingTopLeft: [30, 30], paddingBottomRight: [70, PEEK + 30]})
        }
    }, [variants, map])

    useEffect(() => {
        if (map && from && !to) map.flyTo([from.lat, from.lng], Math.max(map.getZoom(), 15))
    }, [map, from, to])

    const locateMe = async () => {
        setLocErr('')
        try {
            const p = await myLocation()
            setFrom({...p, label: 'Моє місцезнаходження'})
        } catch (e) {
            if (device.pos) setFrom({lat: device.pos.lat, lng: device.pos.lng, label: 'Де пристрій'})
            else setLocErr(e instanceof Error ? e.message : 'Немає геолокації')
        }
    }
    const center = map ? {lat: map.getCenter().lat, lng: map.getCenter().lng} : undefined
    const chosen = variants.find((v) => v.id === selected)

    // Демо-поїздка обраним маршрутом; змінився маршрут чи сторінка — поїздка завершується
    const startRide = () => {
        if (!chosen || !to) return
        setOpen(false)
        rideStart({
            path: chosen.path, dest: to, profile: mover.ors, baseSpeed: mover.speed,
            markers: (markers ?? []).map((mk) => ({id: String(mk.id), lat: mk.lat, lng: mk.lng, severity: mk.severity, label: mk.marker_types?.label ?? 'Позначка'})),
        })
    }
    useEffect(() => { rideStop() }, [chosen?.id, from?.lat, from?.lng, to?.lat, to?.lng, moverId])
    useEffect(() => () => rideStop(), [])

    return (
        <div className='flex h-dvh flex-col'>
            <NavBar mobileBar={false}/>
            <div className='relative flex min-h-0 flex-1'>
                <aside style={mobile && !open ? {maxHeight: PEEK} : undefined}
                       className={`fixed inset-x-0 bottom-[62px] z-[1100] flex max-h-[58vh] flex-col gap-5 rounded-t-3xl border-t border-line bg-white p-[18px] pt-0 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[max-height] duration-300
                                  md:static md:z-auto md:max-h-none md:w-[340px] md:shrink-0 md:overflow-y-auto md:rounded-none md:border-r md:border-t-0 md:pt-[18px] md:shadow-none ${open ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                    {/* Телефон: ручка панелі з коротким підсумком */}
                    <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
                            className='sticky top-0 z-10 -mx-[18px] flex shrink-0 flex-col items-center gap-2 bg-white px-[18px] pb-1 pt-2.5 md:hidden'>
                        <span className='h-1.5 w-10 rounded-full bg-[#d6d9d2]'/>
                        <span className='flex w-full items-center gap-2 text-left'>
                            {chosen ? (
                                <span className='min-w-0 flex-1'>
                                    <span className='block text-lg font-bold'>{fmtMin(chosen.duration)} <span className='text-sm font-medium text-muted'>· {fmtKm(chosen.distance)}</span></span>
                                    <span className='block truncate text-xs text-muted'>{chosen.name} · Комфорт {chosen.comfort}</span>
                                </span>
                            ) : <span className='flex-1 text-lg font-bold'>Навігатор</span>}
                            <span className='flex items-center gap-1 text-sm font-semibold text-brand'>
                                {open ? <>Згорнути <LuChevronDown size={18}/></> : <>{chosen ? 'Варіанти' : 'Маршрут'} <LuChevronUp size={18}/></>}
                            </span>
                        </span>
                    </button>
                    <h1 className='hidden text-2xl font-bold md:block'>Навігатор</h1>

                    <section>
                        <h2 className='rv-label mb-2.5'>Хто рухається</h2>
                        <div className='grid grid-cols-2 gap-2'>
                            {MOVERS.map((m) => (
                                <button key={m.id} onClick={() => setMoverId(m.id)}
                                        className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${m.id === moverId ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line bg-white hover:bg-page'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <p className='mt-2.5 text-xs leading-relaxed text-muted'>Маршрут враховує нерівності, бордюри та схили саме для вибраного профілю.</p>
                    </section>

                    <section>
                        <h2 className='rv-label mb-2.5'>Маршрут</h2>
                        <div className='flex flex-col items-stretch gap-2'>
                            <AddressSearch icon={false} placeholder='Звідки (точка А)' value={from?.label} near={center}
                                           onSelect={(p) => setFrom({lat: p.lat, lng: p.lng, label: p.short})} onClear={clearFrom}
                                           right={<button aria-label='Моє місцезнаходження' onClick={locateMe}
                                                          className='-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand'><LuLocateFixed size={17}/></button>}/>
                            <button aria-label='Поміняти місцями' onClick={swap}
                                    className='mx-auto grid h-8 w-10 place-items-center rounded-lg bg-page text-ink hover:bg-line'><LuArrowUpDown size={16}/></button>
                            <AddressSearch icon={false} placeholder='Куди (точка Б)' value={to?.label} near={center}
                                           onSelect={(p) => setTo({lat: p.lat, lng: p.lng, label: p.short})} onClear={clearTo}/>
                        </div>
                        {locErr && <p className='mt-2 text-xs text-sos'>{locErr}</p>}
                        {(!from || !to) && <p className='mt-2.5 rounded-xl bg-page px-3 py-2.5 text-sm text-muted'>
                            {!from ? 'Вкажіть, звідки їдете, або натисніть на карту.' : 'Тепер куди: адреса або точка на карті.'}
                        </p>}
                        {!from && !to && (
                            <button onClick={() => example(EXAMPLE.a, EXAMPLE.b)}
                                    className='mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/50 px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft'>
                                <LuSparkles size={16}/> Показати приклад маршруту
                            </button>
                        )}
                    </section>

                    {(isLoading || error || variants.length > 0) && (
                        <section>
                            <h2 className='rv-label mb-2.5'>Варіанти</h2>
                            {isLoading && <div className='flex justify-center py-6'><span className='h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand'/></div>}
                            {error && <p className='rounded-xl bg-sos-soft p-3 text-sm text-sos'>Не вдалося побудувати маршрут. Спробуйте інші точки.</p>}
                            {variants.length > 0 && <RouteVariants variants={variants} selected={selected} onSelect={setSelected}/>}
                            {chosen && (
                                <div className='mt-3 rounded-2xl bg-brand-soft p-3'>
                                    <button onClick={startRide}
                                            className='inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 font-semibold text-white'>
                                        <LuPlay size={16}/> {riding ? 'Почати поїздку знову' : 'Демо-поїздка'}
                                    </button>
                                    <p className='mt-2 text-xs leading-relaxed text-brand'>Пристрій проїде маршрут у реальному часі. Коли попереду з'явиться яма, він зупиниться і знайде об'їзд.</p>
                                </div>
                            )}
                        </section>
                    )}

                    <SurveyPanel device={device} onStartHere={(p) => setFrom({...p, label: 'Де пристрій'})}/>
                    <DemoRow className='shrink-0 md:hidden'/>
                </aside>

                <div className='relative min-w-0 flex-1'>
                    <MapView onReady={setMap} controlsBottom={mobile && !open ? PEEK + 62 : 0}>
                        <ClickLayer onPick={pick}/>
                        {from && <Marker icon={createPinIcon('A', '#173d33')} position={[from.lat, from.lng]}/>}
                        {to && <Marker icon={createPinIcon('Б', '#173d33')} position={[to.lat, to.lng]}/>}
                        {variants.length > 0 && !riding && <RoutesLayer variants={variants} selected={selected} onSelect={setSelected}/>}
                        {!riding && <DevicePositionMarker pos={device.pos}/>}
                        <RideLayer/>
                    </MapView>
                    {!riding && <RouteSummary variants={variants} selected={selected}/>}
                    <RideHud onRestart={startRide}/>
                    {chosen && !riding && (
                        <button onClick={startRide} style={mobile ? {bottom: PEEK + 62 + 14} : undefined}
                                className={`absolute left-1/2 z-[1000] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white shadow-lg md:bottom-6 ${mobile && open ? 'hidden' : ''}`}>
                            <LuPlay size={17}/> Демо-поїздка
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
