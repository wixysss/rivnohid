export const BEST_ROUTE_STYLE = { color: '#16a34a', weight: 6, opacity: 0.9 }
export const OTHER_ROUTE_STYLE = { color: '#9ca3af', weight: 4, opacity: 0.7 }
export const ROUTE_STYLES = {
    mapWrap: 'min-w-0 flex-1 overflow-hidden rounded-xl',
    panel:
        'fixed inset-x-0 bottom-0 z-1100 max-h-[50vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg ' +
        'md:static md:z-auto md:max-h-full md:w-80 md:shrink-0 md:self-start md:rounded-xl md:border md:border-gray-200 md:shadow-none',
    hint: 'rounded-lg bg-blue-50 p-3 text-center text-sm text-blue-800',
    errors: 'rounded-lg bg-red-50 p-3 text-center text-sm text-red-700',
    list: 'mt-3 grid grid-cols-2 gap-2 md:grid-cols-1',
    card: 'rounded-xl border border-gray-200 p-2',
    cardBest: 'rounded-xl border-2 border-green-500 bg-green-50 p-2',
    badge: 'mb-1 inline-block rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white',
    badgeMuted: 'mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600',
    stats: 'flex items-baseline justify-between gap-2 text-xs text-gray-500',
    statValue: 'text-sm font-semibold text-gray-900',
    resetButton:
        'mt-3 w-full rounded-lg bg-blue-600 py-2 text-base font-medium text-white hover:bg-blue-700 active:bg-blue-800',
} as const