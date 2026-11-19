import {LEVELS, levelOfRms, roughnessIndex} from "../constants.ts";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";
import {LEVEL_META, LEVEL_ORDER} from "../../../shared/ui/levels.ts";

// Межі шкали 0–100 для 4 рівнів (той самий поділ, що й levelOfRms: 0.06/0.14/0.25 з 0.35)
const STOPS = [0, 17, 40, 71, 100]
const R = 92, CX = 120, CY = 122

const pt = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [CX + R * Math.cos(a), CY - R * Math.sin(a)]
}
const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

// Спідометр «Індекс нерівності» 0–100: чотири сегменти кольору стану
export const RoughnessGauge = ({rms}: { rms: number }) => {
    const value = roughnessIndex(rms)
    const level = levelOfRms(rms)
    return (
        <div className='flex flex-col items-center'>
            <svg viewBox='0 0 240 140' className='w-full max-w-[250px]'>
                {LEVEL_ORDER.map((l, i) => (
                    <path key={l} d={arc(STOPS[i] + (i ? 1.5 : 0), STOPS[i + 1] - (i < 3 ? 1.5 : 0))} fill='none'
                          stroke={LEVEL_META[l].color} strokeWidth='17' strokeLinecap='butt'/>
                ))}
                <line x1={CX} y1={CY} x2={CX} y2={CY - 74} stroke='#13231f' strokeWidth='4' strokeLinecap='round'
                      style={{transform: `rotate(${-90 + value * 1.8}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: 'transform 0.3s ease'}}/>
                <circle cx={CX} cy={CY} r='9' fill='#13231f'/>
            </svg>
            <div className='-mt-1 flex items-baseline gap-2.5'>
                <span className='text-[44px] font-bold leading-none tabular-nums'>{value}</span>
                <span className='flex items-center gap-1.5 text-[17px] font-semibold' style={{color: LEVEL_META[level].text}}>
                    <LevelIcon level={level} size={15}/>{LEVELS[level].label}
                </span>
            </div>
        </div>
    )
}
