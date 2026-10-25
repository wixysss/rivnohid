// Мають збігатися з прошивкою ESP32 (rivnohid_live.ino)
export const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt'
export const MQTT_TOPIC = 'rivnohid/rv7f3k/live'

export const SAMPLE_HZ = 200
export const WAVE_SECONDS = 10
export const STRIP_SECONDS = 120
export const TRACK_POINTS = 600
export const OFFLINE_AFTER_MS = 2500

// Межі для RMS вертикального струсу (g)
export type Level = 'smooth' | 'uneven' | 'rough' | 'bad'

export const LEVELS: Record<Level, { label: string, color: string }> = {
    smooth: {label: 'Рівно', color: '#22c55e'},
    uneven: {label: 'Нерівно', color: '#eab308'},
    rough: {label: 'Погано', color: '#f97316'},
    bad: {label: 'Дуже погано', color: '#ef4444'},
}

export const levelOfRms = (rms: number): Level =>
    rms < 0.06 ? 'smooth' : rms < 0.14 ? 'uneven' : rms < 0.25 ? 'rough' : 'bad'

export const levelOfPeak = (g: number): Level =>
    g < 0.15 ? 'smooth' : g < 0.35 ? 'uneven' : g < 0.6 ? 'rough' : 'bad'

// RMS 0.35 g і більше = 100
export const roughnessIndex = (rms: number) => Math.max(0, Math.min(100, Math.round(rms / 0.35 * 100)))

export type LivePacket = {
    seq: number
    t: number
    hz?: number
    a: number[]        // вертикальний струс, мілі-g
    rms: number
    pk: number
    bump: 0 | 1
    mark: 0 | 1
    bat?: number
    lat?: number
    lon?: number
    spd?: number
    sat?: number
}
