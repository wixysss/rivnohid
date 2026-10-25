import type {LiveStore} from "../liveStore.ts";
import {LEVELS, levelOfPeak} from "../constants.ts";
import {useCanvasLoop} from "./canvasUtils.ts";

// Живий графік вертикального струсу за останні 10 секунд
export const WaveChart = ({store}: { store: LiveStore }) => {
    const ref = useCanvasLoop((ctx, w, h) => {
        const wave = store.wave
        const n = wave.length
        let max = 0
        for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(wave[i]))
        const range = Math.min(2, Math.max(1, Math.ceil(max * 2) / 2))
        const mid = h / 2
        const sy = (h / 2 - 16) / range

        ctx.font = '11px Signika, sans-serif'
        ctx.lineWidth = 1
        for (let g = -range; g <= range + 1e-6; g += 0.5) {
            const y = mid - g * sy
            ctx.strokeStyle = Math.abs(g) < 1e-6 ? '#d4d4d8' : '#f0f0f2'
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(w, y)
            ctx.stroke()
            if (Math.abs(g) > 1e-6) {
                ctx.fillStyle = '#a1a1aa'
                ctx.fillText((g > 0 ? '+' : '') + g.toFixed(1), 4, y - 3)
            }
        }

        const step = w / n
        const bw = Math.max(1, step * 1.2)
        for (let i = 0; i < n; i++) {
            const v = Math.max(-range, Math.min(range, wave[(store.head + i) % n]))
            const a = Math.abs(v)
            if (a < 0.01) continue
            ctx.fillStyle = LEVELS[levelOfPeak(a)].color
            ctx.globalAlpha = Math.min(1, 0.45 + a * 1.5)
            ctx.fillRect(i * step, v > 0 ? mid - v * sy : mid, bw, a * sy)
        }
        ctx.globalAlpha = 1

        const start = store.total - n
        while (store.bumpMarks.length && store.bumpMarks[0] < start) store.bumpMarks.shift()
        ctx.strokeStyle = LEVELS.bad.color
        ctx.fillStyle = LEVELS.bad.color
        ctx.font = '600 12px Signika, sans-serif'
        for (const b of store.bumpMarks) {
            const x = (b - start) * step
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(x, 16)
            ctx.lineTo(x, h)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillText('яма', Math.min(x + 4, w - 28), 13)
        }
    })

    return <canvas ref={ref} className='block w-full h-64'/>
}
