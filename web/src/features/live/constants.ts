// Мають збігатися з прошивкою ESP32 (rivnohid_live.ino)
export const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt'
export const MQTT_TOPIC = 'rivnohid/rv7f3k/live'
export const MQTT_STATUS_TOPIC = 'rivnohid/rv7f3k/status'   // online / offline / low_battery
export const MQTT_EVENT_TOPIC = 'rivnohid/rv7f3k/event'      // запис голосу, нотатки, SOS, карта доріг
export const MQTT_DIAG_TOPIC = 'rivnohid/rv7f3k/diag'        // що підключено до пристрою (retained)

export type DeviceDiag = {
    fw: string, sd: 0 | 1, mic: 0 | 1, oled: 0 | 1, gsm: 0 | 1, mpu: 0 | 1, sos: 0 | 1, ssid?: string, ip?: string
    sim?: 0 | 1, reg?: 0 | 1, csq?: number   // SIM800L: SIM-картка, реєстрація в мережі, сигнал 0..31 (99 = невідомо)
}
export const MQTT_SUBSCRIBE = 'rivnohid/rv7f3k/#'

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
    rec?: 0 | 1        // йде запис голосу
    road?: 0 | 1       // (прошивка 2.x) автопозначки стану доріг
    pt?: number        // номер точки, до якої зараз прив'яжеться голос (0 — немає)
}

export type PointSeverity = 'ok' | 'warning' | 'bad'

export type DeviceEvent =
    | { type: 'rec', on: boolean, lat?: number | null, lon?: number | null, point?: number }
    | { type: 'voice', id: string, lat: number | null, lon: number | null, dur: number }
    | { type: 'sos', lat: number | null, lon: number | null, called: boolean }
    | { type: 'sos_cancel' }
    | { type: 'road', on: boolean }
    | { type: 'marker', lat: number | null, lon: number | null }
    // Кнопка 3: точка. Спершу sent=false (поставлено на пристрої), потім sent=true з id на сервері
    | { type: 'point', n: number, id?: string, lat: number | null, lon: number | null, sev: PointSeverity, sent: boolean }
