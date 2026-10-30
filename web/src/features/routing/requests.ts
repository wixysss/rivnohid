import type {Point} from "../map/types.ts";
import type {Route} from "./types.ts";

type OrsResponse = {
    features: Array<{
        geometry: { coordinates: Array<[number, number]> }
        properties: { summary: { distance: number; duration: number } }
    }>
}

export const getRoutes = async (from: Point, to: Point): Promise<Route[]> => {
    const response = await fetch('https://api.heigit.org/openrouteservice/v2/directions/wheelchair/geojson', {
        method: 'POST',
        headers: {Authorization: import.meta.env.VITE_ORS_API_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
            alternative_routes: {target_count: 3, share_factor: 0.6, weight_factor: 1.6}
        })
    })

    if (!response.ok) throw new Error(`Помилка маршрутів: ${response.status}`)
    const data: OrsResponse = await response.json()

    return data.features.map((feature, index) => ({
        id: index,
        path: feature.geometry.coordinates.map(([lng, lat]) => ({lat, lng})),
        distance: feature.properties.summary.distance,
        duration: feature.properties.summary.duration
    }))
}