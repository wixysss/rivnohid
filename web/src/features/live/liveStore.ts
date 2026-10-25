import {
    type Level,
    type LivePacket,
    levelOfRms,
    SAMPLE_HZ,
    STRIP_SECONDS,
    TRACK_POINTS,
    WAVE_SECONDS,
} from "./constants.ts";

export type LiveEvent = {
    id: number
    time: Date
    kind: 'bump' | 'mark'
    peak: number
    lat?: number
    lon?: number
}

export type TrackPoint = { lat: number, lon: number, rms: number, level: Level }

// Буфери, які оновлюються з частотою даних (200 Гц) і малюються на canvas без ререндерів React
export class LiveStore {
    wave = new Float32Array(SAMPLE_HZ * WAVE_SECONDS)
    head = 0
    total = 0
    bumpMarks: number[] = []
    strip: number[] = []
    track: TrackPoint[] = []
    events: LiveEvent[] = []

    rmsWindow: number[] = []
    rms = 0
    bumps = 0
    peak = 0
    speed?: number
    sat?: number
    bat?: number
    lat?: number
    lon?: number
    lastPacketAt = 0
    version = 0

    private secSq = 0
    private secN = 0
    private secLat?: number
    private secLon?: number
    private eventId = 0

    push(p: LivePacket) {
        this.lastPacketAt = performance.now()
        for (const v of p.a ?? []) {
            const g = v / 1000
            this.wave[this.head] = g
            this.head = (this.head + 1) % this.wave.length
            this.total++
            this.secSq += g * g
            this.secN++
            if (this.secN >= SAMPLE_HZ) this.closeSecond()
        }

        this.rmsWindow.push(p.rms ?? 0)
        if (this.rmsWindow.length > 10) this.rmsWindow.shift()
        this.rms = Math.sqrt(this.rmsWindow.reduce((s, x) => s + x * x, 0) / this.rmsWindow.length)
        this.peak = Math.max(this.peak, p.pk ?? 0)

        this.speed = p.spd
        this.sat = p.sat
        this.bat = p.bat
        if (p.lat != null && p.lon != null) {
            this.lat = p.lat
            this.lon = p.lon
            this.secLat = p.lat
            this.secLon = p.lon
        }

        if (p.bump) {
            this.bumps++
            this.bumpMarks.push(this.total)
            this.addEvent('bump', p)
        }
        if (p.mark) this.addEvent('mark', p)
        this.version++
    }

    private closeSecond() {
        const rms = Math.sqrt(this.secSq / this.secN)
        this.strip.push(rms)
        if (this.strip.length > STRIP_SECONDS) this.strip.shift()
        if (this.secLat != null && this.secLon != null) {
            this.track.push({lat: this.secLat, lon: this.secLon, rms, level: levelOfRms(rms)})
            if (this.track.length > TRACK_POINTS) this.track.shift()
        }
        this.secSq = 0
        this.secN = 0
    }

    private addEvent(kind: LiveEvent['kind'], p: LivePacket) {
        this.events.unshift({id: ++this.eventId, time: new Date(), kind, peak: p.pk ?? 0, lat: p.lat, lon: p.lon})
        if (this.events.length > 50) this.events.pop()
    }

    reset() {
        Object.assign(this, new LiveStore())
    }
}
