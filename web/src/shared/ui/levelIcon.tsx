import {LEVEL_META, type RoadLevel} from "./levels.ts";

// Фігура стану дороги як React-елемент
export const LevelIcon = ({level, size = 14, outline = false, className = ''}: {
    level: RoadLevel, size?: number, outline?: boolean, className?: string
}) => {
    const m = LEVEL_META[level]
    const s = size, h = s / 2, w = outline ? 1.5 : 0
    return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={`shrink-0 ${className}`} aria-hidden
             fill={m.color} stroke={outline ? '#fff' : 'none'} strokeWidth={w}>
            {m.shape === 'circle' && <circle cx={h} cy={h} r={h - w}/>}
            {m.shape === 'square' && <rect x={w + 1} y={w + 1} width={s - 2 * w - 2} height={s - 2 * w - 2} rx={2}/>}
            {m.shape === 'diamond' && <path d={`M${h} 0.5L${s - 0.5} ${h}L${h} ${s - 0.5}L0.5 ${h}Z`}/>}
            {m.shape === 'triangle' && <path d={`M${h} 1L${s - 0.5} ${s - 1}H0.5Z`} strokeLinejoin='round'/>}
        </svg>
    )
}

// Плашка «● Рівно» з м'яким тлом
export const LevelBadge = ({level, label, className = ''}: { level: RoadLevel, label?: string, className?: string }) => {
    const m = LEVEL_META[level]
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
              style={{background: m.soft, color: m.text}}>
            <LevelIcon level={level} size={11}/>{label ?? m.label}
        </span>
    )
}
