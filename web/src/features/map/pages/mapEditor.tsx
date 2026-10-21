import {useState} from "react";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {ClickLayer} from "../components/clickLayer.tsx";
import {Marker} from "react-leaflet";
import {MarkerForm} from "../components/markerForm.tsx";
import {MapView} from "../components/mapView.tsx";
import {createIcon} from "../markerStyles.ts";
import type {Point} from "../types.ts";

export const MapEditor = () => {
    const [point, setPoint] = useState<Point | null>(null)

    return (
        <div className='h-screen flex flex-col '>
            <NavBar/>
            <div className='flex-1 min-h-0 flex justify-center gap-4 p-4'>
                <MapView>
                    <ClickLayer onPick={setPoint}/>
                    {point && <Marker icon={createIcon('ok')} position={[point.lat, point.lng]}/>}
                </MapView>
                {point !== null && (
                    <div className='w-max-80 shrink-0'>
                        <MarkerForm point={point} onSuccess={() => setPoint(null)}/>
                    </div>
                )}
            </div>
        </div>
    )
}