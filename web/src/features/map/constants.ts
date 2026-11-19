export const MAP_CENTER: [number, number] = [50.2547, 28.6587]
export const MAP_ZOOM = 13

// Одна копія світу: не даємо віддалити карту так, щоб вона повторювалась, і прокрутити за край
export const WORLD_BOUNDS: [[number, number], [number, number]] = [[-85, -180], [85, 180]]
export const WORLD_LIMITS = {minZoom: 3, maxBounds: WORLD_BOUNDS, maxBoundsViscosity: 1, worldCopyJump: false} as const

// Справжня карта світу (OpenStreetMap). У перемикачі шарів: світла, класична і супутник.
export type BaseLayerId = 'light' | 'osm' | 'satellite'
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// «Світла» — та сама OpenStreetMap, але приглушена CSS-фільтром (клас rv-pale), щоб маркери читалися краще
export const BASE_LAYERS: Record<BaseLayerId, { label: string, url: string, attribution: string, maxZoom: number, pale?: boolean }> = {
    light: {label: 'Світла', url: OSM_URL, attribution: OSM_ATTR, maxZoom: 19, pale: true},
    osm: {label: 'Класична', url: OSM_URL, attribution: OSM_ATTR, maxZoom: 19},
    satellite: {
        label: 'Супутник',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
    },
}

// Для дрібних карт (сторінка «Наживо»)
export const TILE_URL = BASE_LAYERS.light.url
export const TILE_ATTRIBUTION = BASE_LAYERS.light.attribution
