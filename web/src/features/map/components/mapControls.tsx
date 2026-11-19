import {useState} from "react";
import {useMap} from "react-leaflet";
import L from "leaflet";
import {LuLayers, LuLocateFixed, LuMinus, LuPlus} from "react-icons/lu";
import {BASE_LAYERS, type BaseLayerId} from "../constants.ts";
import {useBaseLayer} from "../baseLayer.ts";
import {myLocation} from "../../../shared/lib/geocode.ts";
import {createDotIcon} from "../markerStyles.ts";

const ctl = 'grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-ink shadow-sm hover:bg-page'

// Свої кнопки поверх карти: шари (вгорі праворуч), масштаб і «де я» (внизу праворуч)
export const MapControls = ({bottomOffset = 0}: { bottomOffset?: number }) => {
    const map = useMap()
    const {layer, setLayer} = useBaseLayer()
    const [open, setOpen] = useState(false)
    const [locating, setLocating] = useState(false)
    const [me, setMe] = useState<L.Marker | null>(null)

    const locate = async () => {
        setLocating(true)
        try {
            const p = await myLocation()
            map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16))
            me?.remove()
            setMe(L.marker([p.lat, p.lng], {icon: createDotIcon(), interactive: false}).addTo(map))
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Не вдалося визначити місце')
        } finally {
            setLocating(false)
        }
    }

    // Кліки по кнопках не повинні ставити точки на карті
    const stop = (el: HTMLDivElement | null) => { if (el) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el) } }

    return (
        <>
            <div ref={stop} className='absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2'>
                <button aria-label='Шари карти' className={ctl} onClick={() => setOpen((v) => !v)}><LuLayers size={20}/></button>
                {open && (
                    <div className='w-40 rounded-2xl border border-line bg-white p-1.5 shadow-xl'>
                        {(Object.keys(BASE_LAYERS) as BaseLayerId[]).map((id) => (
                            <button key={id} onClick={() => { setLayer(id); setOpen(false) }}
                                    className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${layer === id ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-page'}`}>
                                {BASE_LAYERS[id].label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div ref={stop} className='absolute right-3 z-[1000] flex flex-col gap-2' style={{bottom: 24 + bottomOffset}}>
                <button aria-label='Наблизити' className={ctl} onClick={() => map.zoomIn()}><LuPlus size={20}/></button>
                <button aria-label='Віддалити' className={ctl} onClick={() => map.zoomOut()}><LuMinus size={20}/></button>
                <button aria-label='Де я' className={`${ctl} mt-2`} onClick={locate} disabled={locating}>
                    {locating ? <span className='h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand'/> : <LuLocateFixed size={20}/>}
                </button>
            </div>
        </>
    )
}
