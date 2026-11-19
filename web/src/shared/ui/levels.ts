// Стан дороги: 4 рівні. Колір і форма маркера разом, щоб карту можна було читати
// і без розрізнення кольорів (коло, трикутник, квадрат, ромб).
export type RoadLevel = 'smooth' | 'uneven' | 'rough' | 'bad'
export type Shape = 'circle' | 'triangle' | 'square' | 'diamond'

export const LEVEL_ORDER: RoadLevel[] = ['smooth', 'uneven', 'rough', 'bad']

export const LEVEL_META: Record<RoadLevel, { label: string, color: string, soft: string, text: string, shape: Shape }> = {
    smooth: {label: 'Рівно', color: '#1f6fe5', soft: '#e3edfc', text: '#1554b3', shape: 'circle'},
    uneven: {label: 'Нерівно', color: '#e09b0b', soft: '#fdf3dc', text: '#8a5a00', shape: 'triangle'},
    rough: {label: 'Погано', color: '#d9480f', soft: '#fce6dc', text: '#a8350a', shape: 'square'},
    bad: {label: 'Дуже погано', color: '#6e1a36', soft: '#f6e1e8', text: '#6e1a36', shape: 'diamond'},
}

// Позначки на карті мають 3 рівні серйозності (ok / warning / bad)
export type Severity = 'ok' | 'warning' | 'bad'
export const SEVERITY_LEVEL: Record<Severity, RoadLevel> = {ok: 'smooth', warning: 'uneven', bad: 'rough'}
export const SEVERITY_ORDER: Severity[] = ['ok', 'warning', 'bad']
export const levelOfSeverity = (s: string): RoadLevel => SEVERITY_LEVEL[s as Severity] ?? 'smooth'

// SVG фігури (для Leaflet divIcon і canvas-підписів). size — сторона квадрата, що її вміщає.
export const shapeSvg = (level: RoadLevel, size = 16, stroke = '#fff', strokeWidth = 2) => {
    const m = LEVEL_META[level]
    const s = size, h = s / 2, w = strokeWidth
    const body = m.shape === 'circle' ? `<circle cx="${h}" cy="${h}" r="${h - w}"/>`
        : m.shape === 'square' ? `<rect x="${w}" y="${w}" width="${s - 2 * w}" height="${s - 2 * w}" rx="2"/>`
            : m.shape === 'diamond' ? `<path d="M${h} ${w * 0.6}L${s - w * 0.6} ${h}L${h} ${s - w * 0.6}L${w * 0.6} ${h}Z"/>`
                : `<path d="M${h} ${w}L${s - w * 0.5} ${s - w}H${w * 0.5}Z" stroke-linejoin="round"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="${m.color}" stroke="${stroke}" stroke-width="${w}">${body}</svg>`
}
