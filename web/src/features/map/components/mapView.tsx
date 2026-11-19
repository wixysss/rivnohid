import {AttributionControl, MapContainer, Marker, Popup, TileLayer, useMap} from "react-leaflet";
import 'leaflet/dist/leaflet.css'
import type L from "leaflet";
import * as React from "react";
import {useEffect} from "react";
import {BASE_LAYERS, MAP_CENTER, MAP_ZOOM} from "../constants.ts";
import {useMarkers} from "../hooks/useMarkers.ts";
import {createMarkerIcon} from "../markerStyles.ts";
import {MarkerPopup} from "./markerPopup.tsx";
import {PointPopup} from "./pointPopup.tsx";
import {MapControls} from "./mapControls.tsx";
import {TrackLayer} from "../../track/components/trackLayer.tsx";
import {VoiceNoteLayer} from "../../voice/components/voiceNoteLayer.tsx";
import {useBaseLayer} from "../baseLayer.ts";
import type {getMarkers} from "../requests.ts";

export type MarkerRow = Awaited<ReturnType<typeof getMarkers>>[number]

export const isDevicePoint = (m: MarkerRow) => m.source === 'device' && m.marker_types?.slug === 'point'

const Ready = ({onReady}: { onReady: (map: L.Map) => void }) => {
    const map = useMap()
    useEffect(() => { onReady(map) }, [map, onReady])
    return null
}

type MapViewProps = {
    children?: React.ReactNode
    filter?: (m: MarkerRow) => boolean
    showTrack?: boolean
    showVoice?: boolean
    onReady?: (map: L.Map) => void
    controlsBottom?: number          // підняти кнопки масштабу над мобільною панеллю
    className?: string
}

// Карта з позначками, обстеженими дорогами, голосовими нотатками й кнопками керування
export const MapView = ({children, filter, showTrack = true, showVoice = true, onReady, controlsBottom = 0, className = ''}: MapViewProps) => {
    const {data} = useMarkers()
    const layer = BASE_LAYERS[useBaseLayer((s) => s.layer)]
    const markers = filter ? data?.filter(filter) : data

    return (
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} zoomControl={false} attributionControl={false}
                      className={`h-full w-full ${className}`}>
            <TileLayer key={layer.url} url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom}
                       {...(layer.subdomains ? {subdomains: layer.subdomains} : {})}/>
            <AttributionControl position='bottomleft' prefix={false}/>

            {showTrack && <TrackLayer/>}

            {markers?.map((marker) => {
                const point = isDevicePoint(marker)
                return (
                    <Marker key={marker.id} position={[marker.lat, marker.lng]}
                            icon={createMarkerIcon(marker.severity, {
                                device: point,
                                voice: point && (marker.voice_notes?.length ?? 0) > 0,
                                text: !!marker.description,
                            })}>
                        <Popup className='rv-popup' maxWidth={300}>
                            {point ? <PointPopup marker={marker}/> : <MarkerPopup marker={marker}/>}
                        </Popup>
                    </Marker>
                )
            })}

            {showVoice && <VoiceNoteLayer/>}
            <MapControls bottomOffset={controlsBottom}/>
            {onReady && <Ready onReady={onReady}/>}
            {children}
        </MapContainer>
    )
}
