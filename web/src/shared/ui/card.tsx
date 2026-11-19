import * as React from "react";

// Біла картка з тонкою рамкою, як у макеті
export const Card = ({title, right, children, className = '', bodyClassName = ''}: {
    title?: React.ReactNode, right?: React.ReactNode, children: React.ReactNode, className?: string, bodyClassName?: string
}) => (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
        {(title || right) && (
            <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
                {title && <h2 className='rv-label'>{title}</h2>}
                {right}
            </div>
        )}
        <div className={bodyClassName}>{children}</div>
    </section>
)

export const btn = {
    primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50',
    outline: 'inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-page disabled:opacity-50',
    ghost: 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page',
    danger: 'inline-flex items-center justify-center gap-2 rounded-xl bg-sos px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-50',
} as const

export const field = 'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15'
