export const NAV_LINKS = [
    {to: '/map', label: 'Map'},
    {to: '/map/editor', label: 'Map editor'},
    {to: '/route', label: 'Navigator'},
    {to: '/live', label: 'Live'},
    {to: '/settings/sos', label: 'SOS', danger: true},
] as const

export const NAV_STYLES = {
    burger: 'relative z-20 flex h-10 w-10 flex-col items-center justify-center gap-1.5 sm:hidden',
    line: 'block h-0.5 w-7 rounded bg-black transition-all duration-300',
    lineTopOpen: 'translate-y-2 rotate-45',
    lineMidOpen: 'opacity-0',
    lineBotOpen: '-translate-y-2 -rotate-45',
    overlay: 'fixed inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-white/95 backdrop-blur transition-all duration-300 sm:hidden',
    overlayClosed: 'invisible -translate-y-4 opacity-0',
    overlayOpen: 'visible translate-y-0 opacity-100',
    item: 'font-display text-3xl font-bold text-gray-900 transition-all duration-300',
    itemClosed: 'translate-y-4 opacity-0',
    itemOpen: 'translate-y-0 opacity-100',
    danger: 'text-red-600',
    desktopLinks: 'hidden items-center gap-5 sm:flex',
} as const