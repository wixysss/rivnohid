import {useEffect, useRef} from "react";

// Підганяє розмір canvas під CSS-розмір з урахуванням devicePixelRatio
export const fitCanvas = (c: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    const w = Math.round(r.width * dpr)
    const h = Math.round(r.height * dpr)
    if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return {ctx, w: r.width, h: r.height}
}

// Малює canvas на кожному кадрі анімації
export const useCanvasLoop = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const ref = useRef<HTMLCanvasElement>(null)
    const drawRef = useRef(draw)
    drawRef.current = draw

    useEffect(() => {
        let raf = 0
        const loop = () => {
            const c = ref.current
            if (c) {
                const {ctx, w, h} = fitCanvas(c)
                ctx.clearRect(0, 0, w, h)
                drawRef.current(ctx, w, h)
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [])

    return ref
}
