// Пошук адрес через Nominatim (OpenStreetMap). Працює для всього світу.
export type Place = { label: string, short: string, lat: number, lng: number }

type NominatimItem = { display_name: string, lat: string, lon: string, name?: string, address?: Record<string, string> }

const shortName = (it: NominatimItem) => {
    const a = it.address ?? {}
    const street = a.road ? `${a.road}${a.house_number ? ', ' + a.house_number : ''}` : (it.name || '')
    const city = a.city || a.town || a.village || a.municipality || a.state || ''
    return [street, city].filter(Boolean).join(' · ') || it.display_name.split(',').slice(0, 2).join(',')
}

export const searchPlaces = async (q: string, signal?: AbortSignal, near?: { lat: number, lng: number }): Promise<Place[]> => {
    const params = new URLSearchParams({q, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'uk'})
    if (near) {
        const d = 0.6   // підказки ближче до того, що зараз на карті (але не лише там)
        params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {signal})
    if (!r.ok) throw new Error('Пошук недоступний')
    const items: NominatimItem[] = await r.json()
    return items.map((it) => ({label: it.display_name, short: shortName(it), lat: +it.lat, lng: +it.lon}))
}

export const reversePlace = async (lat: number, lng: number): Promise<string> => {
    try {
        const params = new URLSearchParams({lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': 'uk', zoom: '18'})
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
        if (!r.ok) throw new Error()
        const it: NominatimItem = await r.json()
        return shortName(it)
    } catch {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
}

// Поточне місце користувача з браузера
export const myLocation = () => new Promise<{ lat: number, lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Браузер не дає геолокацію'))
    navigator.geolocation.getCurrentPosition(
        (p) => resolve({lat: p.coords.latitude, lng: p.coords.longitude}),
        () => reject(new Error('Немає доступу до геолокації')),
        {enableHighAccuracy: true, timeout: 10000},
    )
})
