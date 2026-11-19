import type {Variant} from "../lib/variants.ts";
import {fmtKm, fmtMin, problemsText} from "../lib/variants.ts";

// Картки варіантів маршруту з рівнем комфорту
export const RouteVariants = ({variants, selected, onSelect}: { variants: Variant[], selected: number | null, onSelect: (id: number) => void }) => (
    <div className='flex flex-col gap-2.5'>
        {variants.map((v) => {
            const on = v.id === selected
            return (
                <button key={v.id} onClick={() => onSelect(v.id)}
                        className={`rounded-2xl border bg-white p-3.5 text-left transition-colors ${on ? 'border-2 border-brand' : 'border-line hover:border-[#c8cbc4]'}`}>
                    <div className='flex items-start gap-2.5'>
                        <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand' : 'border-[#b9bdb6]'}`}>
                            {on && <span className='h-2 w-2 rounded-full bg-brand'/>}
                        </span>
                        <div className='min-w-0 flex-1'>
                            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                                <span className='font-bold'>{v.name}</span>
                                {v.recommended && <span className='rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white'>Рекомендовано</span>}
                                <span className='ml-auto whitespace-nowrap text-sm text-muted'>{fmtMin(v.duration)} · {fmtKm(v.distance)}</span>
                            </div>
                            <div className='mt-2.5 flex items-center gap-2.5'>
                                <span className='h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e9e4]'>
                                    <span className='block h-full rounded-full bg-brand' style={{width: `${v.comfort}%`}}/>
                                </span>
                                <span className='whitespace-nowrap text-xs font-bold'>Комфорт {v.comfort}</span>
                            </div>
                            <p className='mt-1.5 text-xs text-muted'>{problemsText(v.problems)}</p>
                        </div>
                    </div>
                </button>
            )
        })}
    </div>
)
