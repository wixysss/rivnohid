import {useState} from "react";
import {Marker} from "react-leaflet";
import {LuMousePointerClick} from "react-icons/lu";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {ClickLayer} from "../components/clickLayer.tsx";
import {MarkerForm} from "../components/markerForm.tsx";
import {MapView} from "../components/mapView.tsx";
import {createPinIcon} from "../markerStyles.ts";
import type {Point} from "../types.ts";

// Редактор: клік по карті — форма нової позначки
export const MapEditor = () => {
    const [point, setPoint] = useState<Point | null>(null)

    return (
        <div className='flex h-dvh flex-col'>
            <NavBar mobileBar={false}/>
            <div className='relative flex min-h-0 flex-1 pb-[62px] md:pb-0'>
                <aside className={`fixed inset-x-0 bottom-[62px] z-[1100] max-h-[60vh] overflow-y-auto rounded-t-3xl border-t border-line bg-white p-[18px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]
                                   md:static md:z-auto md:max-h-none md:w-[340px] md:shrink-0 md:rounded-none md:border-r md:border-t-0 md:shadow-none ${point ? '' : 'max-md:hidden'}`}>
                    <h1 className='mb-4 text-2xl font-bold'>Нова позначка</h1>
                    {point
                        ? <MarkerForm point={point} onSuccess={() => setPoint(null)} onCancel={() => setPoint(null)}/>
                        : <p className='flex items-start gap-3 rounded-2xl bg-page p-4 text-[15px] text-muted'>
                            <LuMousePointerClick size={22} className='shrink-0 text-brand'/>
                            Натисніть на карті місце, де є проблема: яма, сходи, бордюр без з'їзду.
                        </p>}
                </aside>
                <div className='relative min-w-0 flex-1'>
                    <MapView>
                        <ClickLayer onPick={setPoint}/>
                        {point && <Marker icon={createPinIcon('+', '#173d33')} position={[point.lat, point.lng]}/>}
                    </MapView>
                    {!point && (
                        <div className='pointer-events-none absolute inset-x-3 top-3 z-[1000] rounded-2xl bg-white/95 p-3 text-sm font-medium shadow-md md:hidden'>
                            Натисніть на карті місце проблеми
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
