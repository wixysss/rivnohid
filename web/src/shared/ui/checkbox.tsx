import type {ReactNode} from "react";
import {LuCheck} from "react-icons/lu";

// Квадратний темно-зелений чекбокс як у макеті
export const Check = ({checked}: { checked: boolean }) => (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors ${checked ? 'border-brand bg-brand text-white' : 'border-[#b9bdb6] bg-white'}`}>
        {checked && <LuCheck size={13} strokeWidth={3.2}/>}
    </span>
)

export const CheckRow = ({checked, onChange, children, className = ''}: {
    checked: boolean, onChange: (v: boolean) => void, children: ReactNode, className?: string
}) => (
    <label className={`flex cursor-pointer select-none items-center gap-2.5 text-sm ${className}`}>
        <input type='checkbox' className='sr-only' checked={checked} onChange={(e) => onChange(e.target.checked)}/>
        <Check checked={checked}/>
        {children}
    </label>
)
