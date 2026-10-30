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
        <div className='h-dvh flex flex-col'>
            <NavBar/>
            <div className='flex-1 min-h-0 flex justify-center gap-4 p-2 md:p-4'>
                <MapView>
                    <ClickLayer onPick={setPoint}/>
                    {point && <Marker icon={createIcon('ok')} position={[point.lat, point.lng]}/>}
                </MapView>
                {point !== null && (
                    <div className='fixed inset-x-0 bottom-0 z-1100 max-h-[50vh] overflow-y-auto rounded-t-2xl
                    bg-white p-4 shadow-lg
                    md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-xl md:p-0 md:shadow-none'>
                        <MarkerForm point={point} onSuccess={() => setPoint(null)}/>
                    </div>
                )}
            </div>
        </div>
    )
}