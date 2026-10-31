import {CircleMarker, Tooltip} from "react-leaflet";
import type {DevicePosition} from "../hooks/useDevicePosition.ts";

// Де зараз пристрій (з GPS, наживо через MQTT)
export const DevicePositionMarker = ({pos}: { pos: DevicePosition | null }) => {
    if (!pos) return null
    return (
        <CircleMarker center={[pos.lat, pos.lng]} radius={10}
                      pathOptions={{color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1}}>
            <Tooltip>Пристрій зараз тут{pos.sat ? ` · ${pos.sat} супутн.` : ''}</Tooltip>
        </CircleMarker>
    )
}
