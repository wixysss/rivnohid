import {Polyline} from "react-leaflet";
import type {Variant} from "../lib/variants.ts";

type Props = { variants: Variant[], selected: number | null, onSelect: (id: number) => void }

// Обраний маршрут — темно-зелений, інші — сірі (найкоротший — пунктиром). Клік по лінії обирає варіант.
export const RoutesLayer = ({variants, selected, onSelect}: Props) => {
    const others = variants.filter((v) => v.id !== selected)
    const chosen = variants.find((v) => v.id === selected)
    return (
        <>
            {others.map((v) => (
                <Polyline key={v.id} positions={v.path} eventHandlers={{click: () => onSelect(v.id)}}
                          pathOptions={{color: '#7c8580', weight: 5, opacity: 0.85, dashArray: v.dashed ? '2 10' : undefined, lineCap: 'round'}}/>
            ))}
            {chosen && (
                <>
                    <Polyline positions={chosen.path} pathOptions={{color: '#fff', weight: 10, opacity: 0.9, lineCap: 'round', lineJoin: 'round'}}/>
                    <Polyline positions={chosen.path} pathOptions={{color: '#173d33', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round'}}/>
                </>
            )}
        </>
    )
}
