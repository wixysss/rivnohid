import {useState} from "react";
import type {Point} from "../../map/types.ts";

export const useRoutePoints = () => {
    const [from, setFrom] = useState<Point | null>(null)
    const [to, setTo] = useState<Point | null>(null)

    const pick = (point: Point) => {
        if (!from) {
            setFrom(point)
            return
        }
        if (!to) {
            setTo(point)
            return
        }

        setFrom(point)
        setTo(null)
    }


    const reset = () => {
        setFrom(null)
        setTo(null)
    }
    return {from, to, pick, reset}
}