import L from 'leaflet'
import {LEVEL_META, levelOfSeverity, shapeSvg} from "../../shared/ui/levels.ts";

// Підписи серйозності для форми додавання позначки
export const MARKER_STYLES: Record<string, { label: string }> = {
    ok: {label: LEVEL_META.smooth.label},
    warning: {label: LEVEL_META.uneven.label},
    bad: {label: LEVEL_META.rough.label},
}

const MIC = '<svg viewBox="0 0 24 24" width="9" height="9" fill="#fff"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>'

const cache = new Map<string, L.DivIcon>()

// Маркер позначки: фігура й колір стану дороги. Точка з пристрою має білу «шапочку»
// з мікрофоном (є голос) або крапкою (є текст).
export const createMarkerIcon = (severity: string, opts: { voice?: boolean, text?: boolean, device?: boolean } = {}) => {
    const key = `${severity}|${opts.voice}|${opts.text}|${opts.device}`
    const hit = cache.get(key)
    if (hit) return hit
    const level = levelOfSeverity(severity)
    const badge = opts.voice
        ? `<span style="position:absolute;right:-7px;top:-7px;width:16px;height:16px;border-radius:9px;background:#173d33;border:2px solid #fff;display:grid;place-items:center">${MIC}</span>`
        : opts.device && opts.text
            ? `<span style="position:absolute;right:-5px;top:-5px;width:11px;height:11px;border-radius:6px;background:#173d33;border:2px solid #fff"></span>`
            : ''
    const icon = L.divIcon({
        html: `<div style="position:relative;width:22px;height:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">${shapeSvg(level, 22, '#fff', 2.5)}${badge}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -10],
    })
    cache.set(key, icon)
    return icon
}

// Точки А і Б маршруту, нова позначка в редакторі
export const createPinIcon = (text: string, color = LEVEL_META.smooth.color) => L.divIcon({
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid ${color};display:grid;place-items:center;font:700 13px Inter,sans-serif;color:${color};box-shadow:0 2px 6px rgba(0,0,0,.3)">${text}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
})

export const createDotIcon = (color = '#1f6fe5') => L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 6px ${color}33,0 1px 4px rgba(0,0,0,.3)"></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
})
