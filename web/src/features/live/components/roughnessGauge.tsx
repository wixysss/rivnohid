import {LEVELS, levelOfRms, roughnessIndex} from "../constants.ts";

// Спідометр "Індекс нерівності" 0–100
export const RoughnessGauge = ({rms}: { rms: number }) => {
    const value = roughnessIndex(rms)
    const level = LEVELS[levelOfRms(rms)]

    return (
        <div className='flex flex-col items-center'>
            <svg viewBox='0 0 240 140' className='w-full max-w-64'>
                <defs>
                    <linearGradient id='rg' x1='0' x2='1'>
                        <stop offset='0' stopColor={LEVELS.smooth.color}/>
                        <stop offset='0.45' stopColor={LEVELS.uneven.color}/>
                        <stop offset='0.75' stopColor={LEVELS.rough.color}/>
                        <stop offset='1' stopColor={LEVELS.bad.color}/>
                    </linearGradient>
                </defs>
                <path d='M30 125 A90 90 0 0 1 210 125' fill='none' stroke='#f0f0f2' strokeWidth='18'
                      strokeLinecap='round'/>
                <path d='M30 125 A90 90 0 0 1 210 125' fill='none' stroke='url(#rg)' strokeWidth='18'
                      strokeLinecap='round' pathLength={100} strokeDasharray={`${value} 100`}
                      style={{transition: 'stroke-dasharray 0.3s ease'}}/>
                <line x1='120' y1='125' x2='120' y2='50' stroke='#18181b' strokeWidth='3' strokeLinecap='round'
                      style={{transform: `rotate(${-90 + value * 1.8}deg)`, transformOrigin: '120px 125px', transition: 'transform 0.3s ease'}}/>
                <circle cx='120' cy='125' r='6' fill='#18181b'/>
            </svg>
            <div className='text-5xl font-semibold leading-none -mt-1'>{value}</div>
            <div className='font-medium mt-1' style={{color: level.color}}>{level.label}</div>
        </div>
    )
}
