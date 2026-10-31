import {MapContainer, Marker, Popup, TileLayer} from "react-leaflet";
import {MAP_CENTER, MAP_ZOOM, TILE_ATTRIBUTION, TILE_URL} from "../constants.ts";
import 'leaflet/dist/leaflet.css'
import {useMarkers} from "../hooks/useMarkers.ts";
import {createIcon, createPointIcon} from "../markerStyles.ts";
import {MarkerPopup} from "./markerPopup.tsx";
import {PointPopup} from "./pointPopup.tsx";
import {TrackLayer} from "../../track/components/trackLayer.tsx";
import * as React from "react";
import {VoiceNoteLayer} from "../../voice/components/voiceNoteLayer.tsx";

type MapViewProps = {
    children?: React.ReactNode
}
export const MapView = ({children}: MapViewProps) => {
    const {data} = useMarkers()
    return (
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM}
                      className='w-full max-w-5xl h-full overflow-hidden rounded-xl'>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION}/>

            <TrackLayer/>

            {data?.map((marker) => {
                const isPoint = marker.source === 'device' && marker.marker_types?.slug === 'point'
                return (
                    <Marker key={marker.id} position={[marker.lat, marker.lng]}
                            icon={isPoint
                                ? createPointIcon(marker.severity, (marker.voice_notes?.length ?? 0) > 0, !!marker.description)
                                : createIcon(marker.severity)}>
                        <Popup>
                            {isPoint ? <PointPopup marker={marker}/> : <MarkerPopup marker={marker}/>}
                        </Popup>
                    </Marker>
                )
            })}

            <VoiceNoteLayer/>

            {children}
        </MapContainer>
    )
}