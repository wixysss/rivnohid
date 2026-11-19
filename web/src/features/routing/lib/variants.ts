import type {ScoredRoute} from "../types.ts";

export type Variant = ScoredRoute & { name: string, comfort: number, recommended: boolean, dashed: boolean }

const problemsText = (n: number) =>
    n === 0 ? 'Без проблемних точок'
        : n % 10 === 1 && n % 100 !== 11 ? `${n} проблемна точка`
            : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? `${n} проблемні точки`
                : `${n} проблемних точок`
export {problemsText}

// Комфорт 0–100: що більше штрафу за нерівності поруч з маршрутом, то менше
export const comfortOf = (fine: number) => Math.max(5, Math.min(100, Math.round(100 - fine * 6)))

// Назви варіантів як у навігаторі: найкомфортніший (рекомендований), найкоротший, збалансований
export const toVariants = (routes: ScoredRoute[]): Variant[] => {
    if (!routes.length) return []
    const best = routes[0]
    const shortest = routes.reduce((a, b) => (b.distance < a.distance ? b : a))
    return routes.map((r) => {
        const isBest = r.id === best.id
        const isShort = !isBest && r.id === shortest.id
        return {
            ...r,
            name: isBest ? 'Найкомфортніший' : isShort ? 'Найкоротший' : 'Збалансований',
            comfort: comfortOf(r.fine),
            recommended: isBest,
            dashed: isShort,
        }
    })
}

export const fmtMin = (s: number) => {
    const m = Math.max(1, Math.round(s / 60))
    return m < 60 ? `${m} хв` : `${Math.floor(m / 60)} год ${m % 60} хв`
}
export const fmtKm = (m: number) => `${(m / 1000).toFixed(1).replace('.', ',')} км`
