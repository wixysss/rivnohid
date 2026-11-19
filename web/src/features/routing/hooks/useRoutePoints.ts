import {useState} from "react";
import type {Point} from "../../map/types.ts";
import {reversePlace} from "../../../shared/lib/geocode.ts";

export type RouteEnd = Point & { label: string }

// Точки А і Б: з пошуку адреси, з геолокації або кліком по карті
export const useRoutePoints = () => {
    const [from, setFromRaw] = useState<RouteEnd | null>(null)
    const [to, setToRaw] = useState<RouteEnd | null>(null)

    // Клік по карті без підпису — підпис підтягуємо з адреси
    const withLabel = (p: Point, set: (e: RouteEnd) => void) => {
        set({...p, label: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`})
        void reversePlace(p.lat, p.lng).then((label) => set({...p, label}))
    }

    const setFrom = (p: RouteEnd) => setFromRaw(p)
    const setTo = (p: RouteEnd) => setToRaw(p)

    const pick = (point: Point) => {
        if (!from) return withLabel(point, setFromRaw)
        if (!to) return withLabel(point, setToRaw)
        withLabel(point, setFromRaw)
        setToRaw(null)
    }

    const swap = () => {
        setFromRaw(to)
        setToRaw(from)
    }

    const reset = () => {
        setFromRaw(null)
        setToRaw(null)
    }
    return {from, to, setFrom, setTo, clearFrom: () => setFromRaw(null), clearTo: () => setToRaw(null), pick, swap, reset}
}
