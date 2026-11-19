import type {Variant} from "../lib/variants.ts";
import {fmtKm, fmtMin, problemsText} from "../lib/variants.ts";

// Плаваюча картка над картою: час, відстань і легенда ліній
export const RouteSummary = ({variants, selected}: { variants: Variant[], selected: number | null }) => {
    const v = variants.find((x) => x.id === selected)
    if (!v) return null
    const worst = Math.max(...variants.map((x) => x.problems))
    const avoided = worst - v.problems
    const line = (style: string) => <span className={`inline-block h-0 w-9 border-t-4 ${style}`}/>
    return (
        <div className='absolute left-3 top-3 z-[1000] hidden w-60 rounded-2xl border border-line bg-white p-4 shadow-lg md:block'>
            <p className='flex items-baseline gap-2'>
                <span className='text-[28px] font-bold leading-none'>{fmtMin(v.duration)}</span>
                <span className='text-muted'>{fmtKm(v.distance)}</span>
            </p>
            <p className='mt-1.5 text-sm text-muted'>
                {v.name}{avoided > 0 ? ` · оминає ${problemsText(avoided).toLowerCase()}` : v.problems ? ` · ${problemsText(v.problems).toLowerCase()}` : ' · без проблемних точок'}
            </p>
            {variants.length > 1 && (
                <ul className='mt-3 space-y-1.5 text-sm'>
                    <li className='flex items-center gap-2.5'>{line('border-brand')}Обраний</li>
                    {variants.some((x) => x.id !== selected && !x.dashed) && <li className='flex items-center gap-2.5'>{line('border-[#9aa19d]')}Інші варіанти</li>}
                    {variants.some((x) => x.id !== selected && x.dashed) && <li className='flex items-center gap-2.5'>{line('border-dotted border-[#7c8580]')}Найкоротший</li>}
                </ul>
            )}
        </div>
    )
}
