import type {LiveStore} from "../liveStore.ts";
import {levelOfRms, STRIP_SECONDS} from "../constants.ts";
import {useCanvasLoop} from "./canvasUtils.ts";
import {LEVEL_META, type RoadLevel} from "../../../shared/ui/levels.ts";

// Біла фігура рівня всередині сегмента
const glyph = (ctx: CanvasRenderingContext2D, level: RoadLevel, x: number, y: number) => {
    const s = LEVEL_META[level].shape, r = 5
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (s === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8) }
    else if (s === 'square') ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6)
    else if (s === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y) }
    else return
    ctx.closePath()
    ctx.fill()
}

// «Стрічка дороги» за 2 хвилини: суцільні відрізки кольору стану, всередині — фігура рівня
export const RoadStrip = ({store}: { store: LiveStore }) => {
    const ref = useCanvasLoop((ctx, w, h) => {
        ctx.fillStyle = '#eef0eb'
        ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill()

        const sw = w / STRIP_SECONDS
        const offset = STRIP_SECONDS - store.strip.length
        // зливаємо сусідні секунди одного рівня
        const runs: { level: RoadLevel, from: number, to: number }[] = []
        store.strip.forEach((rms, i) => {
            const level = levelOfRms(rms), last = runs[runs.length - 1]
            if (last && last.level === level) last.to = i + 1
            else runs.push({level, from: i, to: i + 1})
        })
        for (const r of runs) {
            const x = (offset + r.from) * sw + 1.5, wd = (r.to - r.from) * sw - 3
            if (wd <= 0) continue
            ctx.fillStyle = LEVEL_META[r.level].color
            ctx.beginPath(); ctx.roundRect(x, 0, wd, h, 6); ctx.fill()
            if (r.level !== 'smooth' && wd > 16) glyph(ctx, r.level, x + wd / 2, h / 2)
        }
    })

    return <canvas ref={ref} className='block h-7 w-full'/>
}
