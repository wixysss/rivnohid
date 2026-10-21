import {useMapEvents} from "react-leaflet";
import type {Point} from "../types.ts";

type ClickLayerProps = {
    onPick: (point:Point) => void
}
export const ClickLayer = ({onPick}: ClickLayerProps) => {
    useMapEvents({click: (e) => onPick({lat: e.latlng.lat, lng: e.latlng.lng})})
    return null
}