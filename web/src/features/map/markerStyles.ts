import L from 'leaflet'

export const MARKER_STYLES: Record<string, { bg: string, label: string }> = {
    ok: {bg: 'bg-green-500',label:'Зелений'},
    warning: {bg: 'bg-yellow-400',label:'Жовтий'},
    bad: {bg: 'bg-red-500',label: 'Червоний'},
}

const DEFAULT_STYLE = {bg: 'bg-gray-400', label: 'Невідомо'}

export const getSeverityStyle = (severity: string) => MARKER_STYLES[severity] ?? DEFAULT_STYLE

export const createIcon = (severity: string) => {
    const style = getSeverityStyle(severity)
    return L.divIcon({
        html: `<div class="w-6 h-6 rounded-full border-2 border-white ${style.bg}"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    })
}



