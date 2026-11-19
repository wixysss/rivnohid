import type {LiveStore} from "../liveStore.ts";
import {useCanvasLoop} from "./canvasUtils.ts";
import {LEVEL_META} from "../../../shared/ui/levels.ts";

// Смуги тла за рівнями піку (ті самі межі, що levelOfPeak: 0.15 / 0.35 / 0.6 g)
const BANDS: [number, number, string][] = [
    [0, 0.15, LEVEL_META.smooth.soft],
    [0.15, 0.35, LEVEL_META.uneven.soft],
    [0.35, 0.6, LEVEL_META.rough.soft],
    [0.6, 9, LEVEL_META.bad.soft],
]

const diamond = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
    ctx.beginPath()
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
    ctx.fillStyle = color; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke()
}

// Живий графік вертикального струсу за останні 10 секунд: лінія на кольорових смугах
export const WaveChart = ({store}: { store: LiveStore }) => {
    const ref = useCanvasLoop((ctx, w, h) => {
        const wave = store.wave
        const n = wave.length
        let max = 0
        for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(wave[i]))
        const range = Math.min(2, Math.max(1, Math.ceil(max * 2) / 2))
        const left = 44, top = 8, bottom = 8
        const pw = w - left - 4, ph = h - top - bottom
        const mid = top + ph / 2
        const sy = ph / 2 / range
        const Y = (g: number) => mid - g * sy

        // смуги
        for (const [a, b, c] of BANDS) {
            const lo = Math.min(a, range), hi = Math.min(b, range)
            if (lo >= hi) continue
            ctx.fillStyle = c
            ctx.fillRect(left, Y(hi), pw, (hi - lo) * sy)
            ctx.fillRect(left, Y(-lo), pw, (hi - lo) * sy)
        }
        // сітка й підписи
        ctx.font = '12px Inter, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        for (let g = -range; g <= range + 1e-6; g += 0.5) {
            ctx.strokeStyle = Math.abs(g) < 1e-6 ? '#9aa19d' : 'rgba(19,35,31,0.12)'
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(left, Y(g)); ctx.lineTo(left + pw, Y(g)); ctx.stroke()
            ctx.fillStyle = '#5e6a65'
            ctx.fillText((g > 0 ? '+' : g < 0 ? '−' : '+') + Math.abs(g).toFixed(1).replace('.', ','), left - 8, Y(g))
        }

        // лінія: на кожен піксель — мін і макс відліків, щоб не губити ями
        const per = n / pw
        ctx.strokeStyle = '#13231f'
        ctx.lineWidth = 1.6
        ctx.lineJoin = 'round'
        ctx.beginPath()
        for (let x = 0; x < pw; x++) {
            const i0 = Math.floor(x * per), i1 = Math.max(i0 + 1, Math.floor((x + 1) * per))
            let lo = Infinity, hi = -Infinity
            for (let i = i0; i < i1; i++) {
                const v = Math.max(-range, Math.min(range, wave[(store.head + i) % n]))
                if (v < lo) lo = v
                if (v > hi) hi = v
            }
            if (x === 0) ctx.moveTo(left, Y(lo))
            ctx.lineTo(left + x, Y(lo))
            ctx.lineTo(left + x, Y(hi))
        }
        ctx.stroke()

        // ями — ромби на піку
        const start = store.total - n
        while (store.bumpMarks.length && store.bumpMarks[0] < start) store.bumpMarks.shift()
        for (const b of store.bumpMarks) {
            let peakV = 0, peakI = b - start
            for (let k = Math.max(0, b - start - 30); k < Math.min(n, b - start + 30); k++) {
                const v = wave[(store.head + k) % n]
                if (Math.abs(v) > Math.abs(peakV)) { peakV = v; peakI = k }
            }
            const v = Math.max(-range, Math.min(range, peakV))
            diamond(ctx, left + peakI / per, Y(v), 8, LEVEL_META.bad.color)
        }
    })

    return <canvas ref={ref} className='block h-64 w-full'/>
}
