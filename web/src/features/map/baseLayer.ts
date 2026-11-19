import {create} from "zustand";
import type {BaseLayerId} from "./constants.ts";

const KEY = 'rv-base-layer'
const read = (): BaseLayerId => {
    try {
        const v = localStorage.getItem(KEY)
        if (v === 'light' || v === 'osm' || v === 'satellite') return v
    } catch { /* приватний режим */ }
    return 'light'
}

// Обраний шар карти — спільний для всіх сторінок і запам'ятовується в браузері
export const useBaseLayer = create<{ layer: BaseLayerId, setLayer: (l: BaseLayerId) => void }>((set) => ({
    layer: read(),
    setLayer: (layer) => {
        try { localStorage.setItem(KEY, layer) } catch { /* приватний режим */ }
        set({layer})
    },
}))
