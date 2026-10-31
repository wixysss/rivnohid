import {useMemo} from "react";
import L from "leaflet";
import {Polyline, Tooltip} from "react-leaflet";
import {useDeviceTrack} from "../hooks/useDeviceTrack.ts";
import {LEVEL_COLOR, LEVEL_LABEL, toRuns} from "../lib/segments.ts";

const renderer = L.canvas({padding: 0.5})

// Обстежені пристроєм дороги: лінія, пофарбована за станом покриття
export const TrackLayer = () => {
    const {data} = useDeviceTrack()
    const runs = useMemo(() => toRuns(data ?? []), [data])
    return (
        <>
            {runs.map((r, i) => (
                <Polyline key={i} positions={r.path} renderer={renderer}
                          pathOptions={{color: LEVEL_COLOR[r.level], weight: 6, opacity: 0.85, lineCap: 'round'}}>
                    <Tooltip sticky>Обстежено пристроєм: {LEVEL_LABEL[r.level].toLowerCase()}</Tooltip>
                </Polyline>
            ))}
        </>
    )
}
