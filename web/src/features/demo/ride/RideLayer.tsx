import {useEffect, useMemo, useRef} from "react";
import {Marker, Polyline, Tooltip, useMap} from "react-leaflet";
import L from "leaflet";
import {rideSetFollow, useRide} from "./rideStore.ts";
import {cumulative, slice} from "../../routing/lib/path.ts";
import {shapeSvg} from "../../../shared/ui/levels.ts";

// Стрілка «пристрою», що їде: повертаємо її внутрішній елемент, щоб не створювати іконку щокадру
const riderIcon = L.divIcon({
    html: `<div class="rv-rider"><span class="rv-rider-pulse"></span><svg class="rv-rider-arrow" viewBox="0 0 40 40" width="40" height="40">
<circle cx="20" cy="20" r="15" fill="#173d33" stroke="#fff" stroke-width="3"/>
<path d="M20 9 L27.5 27 L20 23 L12.5 27 Z" fill="#fff"/></svg></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
})

const pitIcon = (fresh: boolean, done: boolean) => L.divIcon({
    html: `<div class="rv-pit ${fresh && !done ? 'rv-pit-fresh' : ''}" style="opacity:${done ? 0.55 : 1}">${shapeSvg('bad', 24, '#fff', 2.5)}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
})
const PIT_ICONS = {fresh: pitIcon(true, false), freshDone: pitIcon(true, true), plain: pitIcon(false, false), plainDone: pitIcon(false, true)}

export const RideLayer = () => {
    const map = useMap()
    const plan = useRide((s) => s.plan)
    const dist = useRide((s) => s.dist)
    const total = useRide((s) => s.total)
    const pos = useRide((s) => s.pos)
    const heading = useRide((s) => s.heading)
    const trail = useRide((s) => s.trail)
    const abandoned = useRide((s) => s.abandoned)
    const hazards = useRide((s) => s.hazards)
    const follow = useRide((s) => s.follow)
    const status = useRide((s) => s.status)
    const marker = useRef<L.Marker>(null)

    const cum = useMemo(() => cumulative(plan), [plan])
    const ahead = useMemo(() => plan.length > 1 ? slice(plan, cum, dist, total) : [], [plan, cum, dist, total])

    // Камера на старті
    useEffect(() => {
        if (plan.length && status === 'running' && trail.length === 1) map.setView([plan[0].lat, plan[0].lng], Math.max(map.getZoom(), 17))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan])

    // Камера стежить за пристроєм; перетягнув карту — стеження вимикається
    const lastPan = useRef(0)
    useEffect(() => {
        if (!follow || !pos) return
        const now = performance.now()
        if (now - lastPan.current < 250) return
        lastPan.current = now
        map.panTo([pos.lat, pos.lng], {animate: true, duration: 0.25, easeLinearity: 1})
    }, [pos, follow, map])
    useEffect(() => {
        const off = () => rideSetFollow(false)
        map.on('dragstart', off)
        return () => { map.off('dragstart', off) }
    }, [map])

    useEffect(() => {
        const el = marker.current?.getElement()?.querySelector<SVGElement>('.rv-rider-arrow')
        if (el) el.style.transform = `rotate(${heading}deg)`
    }, [heading, pos])

    if (!pos) return null
    return (
        <>
            {abandoned.map((path, i) => (
                <Polyline key={`ab${i}`} positions={path} pathOptions={{color: '#8b938e', weight: 5, opacity: 0.8, dashArray: '3 10', lineCap: 'round'}}>
                    <Tooltip sticky>Початковий маршрут: тут яма, тому об'їзд</Tooltip>
                </Polyline>
            ))}
            {ahead.length > 1 && <>
                <Polyline positions={ahead} pathOptions={{color: '#fff', weight: 10, opacity: 0.9, lineCap: 'round', lineJoin: 'round'}}/>
                <Polyline positions={ahead} pathOptions={{color: '#173d33', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round'}}/>
            </>}
            {trail.length > 1 && <Polyline positions={[...trail, pos]} pathOptions={{color: '#1f6fe5', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round'}}/>}

            {hazards.filter((h) => h.kind === 'pit' && h.state !== 'hidden').map((h) => {
                const done = h.state === 'avoided' || h.state === 'passed'
                return (
                    <Marker key={h.id} position={[h.p.lat, h.p.lng]} zIndexOffset={500}
                            icon={h.fresh ? (done ? PIT_ICONS.freshDone : PIT_ICONS.fresh) : (done ? PIT_ICONS.plainDone : PIT_ICONS.plain)}>
                        <Tooltip direction='top' offset={[0, -12]}>
                            {h.label}{h.state === 'avoided' ? ' · оминули' : h.state === 'unavoidable' ? ' · обійти неможливо' : h.state === 'passed' ? ' · позаду' : ''}
                        </Tooltip>
                    </Marker>
                )
            })}

            <Marker ref={marker} position={[pos.lat, pos.lng]} icon={riderIcon} zIndexOffset={1000} interactive={false}/>
        </>
    )
}
