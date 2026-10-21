import {MapContainer, Marker, Popup, TileLayer} from "react-leaflet";
import {MAP_CENTER, MAP_ZOOM, TILE_ATTRIBUTION, TILE_URL} from "../constants.ts";
import 'leaflet/dist/leaflet.css'
import {useMarkers} from "../hooks/useMarkers.ts";
import {createIcon} from "../markerStyles.ts";
import {MarkerPopup} from "./markerPopup.tsx";
import * as React from "react";

type MapViewProps = {
    children?: React.ReactNode
}
export const MapView = ({children}: MapViewProps) => {
    const {data} = useMarkers()
    return (
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM}
                      className='w-full max-w-5xl h-full overflow-hidden rounded-xl'>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION}/>

            {data?.map((marker) => (
                <Marker key={marker.id} position={[marker.lat, marker.lng]}
                        icon={createIcon(marker.severity)}>
                    <Popup>
                        <MarkerPopup marker={marker}/>
                    </Popup>
                </Marker>
            ))}

            {children}
        </MapContainer>
    )
}