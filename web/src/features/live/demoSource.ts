import type {LivePacket} from "./constants.ts";

// Імітація пристрою для презентації без заліза: 10 пакетів на секунду
export const startDemo = (onPacket: (p: LivePacket) => void) => {
    let t = 0
    let seq = 0
    let lat = 50.2547
    let lon = 28.6587

    const id = setInterval(() => {
        const a: number[] = []
        let sq = 0
        let pk = 0
        const rough = 0.03 + 0.1 * (0.5 + 0.5 * Math.sin(t / 9)) + (Math.sin(t / 23) > 0.7 ? 0.12 : 0)
        const pothole = Math.random() < 0.006

        for (let i = 0; i < 20; i++) {
            let g = (Math.random() - 0.5) * 2 * rough + Math.sin((t + i / 200) * 40) * rough * 0.4
            if (pothole && i > 4 && i < 14) {
                g += Math.sin((i - 4) / 10 * Math.PI) * (i < 9 ? -1 : 1.6) * (0.7 + Math.random())
            }
            a.push(Math.round(g * 1000))
            sq += g * g
            pk = Math.max(pk, Math.abs(g))
        }

        t += 0.1
        lat += 0.0000035
        lon += 0.000005 * (1 + 0.3 * Math.sin(t / 15))

        onPacket({
            seq: seq++, t: Math.round(t * 1000), a,
            rms: Math.sqrt(sq / 20), pk,
            bump: pk > 0.6 ? 1 : 0, mark: 0,
            lat, lon, spd: 4 + Math.sin(t / 5), sat: 8, bat: 3.9,
        })
    }, 100)

    return () => clearInterval(id)
}
