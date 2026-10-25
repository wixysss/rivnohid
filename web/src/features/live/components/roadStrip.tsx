import type {LiveStore} from "../liveStore.ts";
import {LEVELS, levelOfRms, STRIP_SECONDS} from "../constants.ts";
import {useCanvasLoop} from "./canvasUtils.ts";

// "Стрічка дороги": кожна секунда — стовпчик, пофарбований за якістю покриття
export const RoadStrip = ({store}: { store: LiveStore }) => {
    const ref = useCanvasLoop((ctx, w, h) => {
        ctx.fillStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.roundRect(0, 0, w, h, 8)
        ctx.fill()

        const sw = w / STRIP_SECONDS
        const offset = STRIP_SECONDS - store.strip.length
        store.strip.forEach((rms, i) => {
            const bh = Math.max(6, Math.min(1, rms / 0.35) * h)
            ctx.fillStyle = LEVELS[levelOfRms(rms)].color
            ctx.fillRect((offset + i) * sw, h - bh, Math.max(1, sw - 1), bh)
        })
    })

    return <canvas ref={ref} className='block w-full h-12'/>
}
