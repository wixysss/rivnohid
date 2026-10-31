import L from 'leaflet'

export const MARKER_STYLES: Record<string, { bg: string, label: string }> = {
    ok: {bg: 'bg-green-500',label:'Зелений'},
    warning: {bg: 'bg-yellow-400',label:'Жовтий'},
    bad: {bg: 'bg-red-500',label: 'Червоний'},
}

const DEFAULT_STYLE = {bg: 'bg-gray-400', label: 'Невідомо'}

export const getSeverityStyle = (severity: string) => MARKER_STYLES[severity] ?? DEFAULT_STYLE

// Точка з пристрою: кільце кольору стану дороги, всередині мікрофон, якщо є голос
const POINT_RING: Record<string, string> = {ok: '#22c55e', warning: '#eab308', bad: '#ef4444'}
const MIC = '<svg viewBox="0 0 24 24" width="12" height="12" fill="#7c3aed"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>'
export const createPointIcon = (severity: string, hasVoice: boolean, hasText: boolean) => L.divIcon({
    html: `<div style="border-color:${POINT_RING[severity] ?? '#9ca3af'}" class="flex h-7 w-7 items-center justify-center rounded-full border-4 bg-white shadow">
             ${hasVoice ? MIC : `<span class="block h-2 w-2 rounded-full ${hasText ? 'bg-violet-600' : 'bg-zinc-400'}"></span>`}
           </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
})

export const createIcon = (severity: string) => {
    const style = getSeverityStyle(severity)
    return L.divIcon({
        html: `<div class="w-6 h-6 rounded-full border-2 border-white ${style.bg}"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    })
}



