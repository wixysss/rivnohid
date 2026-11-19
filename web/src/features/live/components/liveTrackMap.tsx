import {CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap} from "react-leaflet";
import 'leaflet/dist/leaflet.css'
import {useEffect, useRef} from "react";
import {MAP_CENTER, MAP_ZOOM, TILE_ATTRIBUTION, TILE_URL, WORLD_LIMITS} from "../../map/constants.ts";
import {LEVELS} from "../constants.ts";
import type {LiveEvent, TrackPoint} from "../liveStore.ts";

const Follow = ({lat, lon}: { lat?: number, lon?: number }) => {
    const map = useMap()
    const first = useRef(true)
    useEffect(() => {
        if (lat == null || lon == null) return
        if (first.current) {
            map.setView([lat, lon], 17)
            first.current = false
        } else if (!map.getBounds().pad(-0.2).contains([lat, lon])) {
            map.panTo([lat, lon])
        }
    }, [map, lat, lon])
    return null
}

type Props = {
    track: TrackPoint[]
    events: LiveEvent[]
    lat?: number
    lon?: number
}

// Маршрут візка, пофарбований за якістю дороги, + ями та поточна позиція
export const LiveTrackMap = ({track, events, lat, lon}: Props) => (
    <div className='relative h-full min-h-60 overflow-hidden rounded-xl'>
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} preferCanvas {...WORLD_LIMITS} className='rv-pale h-full min-h-60 w-full'>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} noWrap/>
            {track.slice(1).map((p, i) => (
                <Polyline key={i} positions={[[track[i].lat, track[i].lon], [p.lat, p.lon]]}
                          pathOptions={{color: LEVELS[p.level].color, weight: 6, opacity: 0.95, lineCap: 'round'}}/>
            ))}
            {events.filter((e) => e.kind === 'bump' && e.lat != null && e.lon != null).map((e) => (
                <CircleMarker key={e.id} center={[e.lat!, e.lon!]} radius={8}
                              pathOptions={{color: '#fff', weight: 2, fillColor: LEVELS.rough.color, fillOpacity: 1}}>
                    <Tooltip>Яма · {e.peak.toFixed(2)} g · {e.time.toLocaleTimeString('uk-UA')}</Tooltip>
                </CircleMarker>
            ))}
            {events.filter((e) => e.kind === 'point' && e.lat != null && e.lon != null).map((e) => (
                <CircleMarker key={e.id} center={[e.lat!, e.lon!]} radius={9}
                              pathOptions={{color: '#173d33', weight: 3, fillColor: '#fff', fillOpacity: 1}}>
                    <Tooltip>Точка {e.pointN} · {e.time.toLocaleTimeString('uk-UA')}</Tooltip>
                </CircleMarker>
            ))}
            {lat != null && lon != null && (
                <CircleMarker center={[lat, lon]} radius={9}
                              pathOptions={{color: '#173d33', weight: 4, fillColor: '#fff', fillOpacity: 1}}>
                    <Tooltip>Візок зараз</Tooltip>
                </CircleMarker>
            )}
            <Follow lat={lat} lon={lon}/>
        </MapContainer>
        {lat == null && (
            <div className='absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-sm text-muted shadow'>
                Чекаю на GPS: на вулиці перший фікс займає 1–15 хвилин. Графіки працюють і без нього.
            </div>
        )}
    </div>
)
