import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useMarkerTypes} from "../hooks/useMarkerTypes.ts";
import {useCreateMarker} from "../hooks/useCreateMarker.ts";
import {markerSchema, type MarkerValues} from "../schemas.ts";
import type {Point} from "../types.ts";
import {LEVEL_META, SEVERITY_LEVEL, SEVERITY_ORDER} from "../../../shared/ui/levels.ts";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";
import {btn} from "../../../shared/ui/card.tsx";

// Позначки, які ставить лише пристрій, — у формі їх не пропонуємо
const DEVICE_ONLY = ['device', 'road', 'point']

type MarkerFormProps = {
    point: Point
    onSuccess: () => void
    onCancel?: () => void
}
export const MarkerForm = ({point, onSuccess, onCancel}: MarkerFormProps) => {
    const {register, handleSubmit, setError, watch, formState: {errors, isSubmitting}} =
        useForm<MarkerValues>({resolver: zodResolver(markerSchema), defaultValues: {severity: 'warning', description: ''}})
    const {data: types} = useMarkerTypes()
    const {mutateAsync} = useCreateMarker()
    const severity = watch('severity')

    const onSubmit = async (values: MarkerValues) => {
        try {
            await mutateAsync({...values, ...point})
            onSuccess()
        } catch {
            setError('root', {message: 'Не вдалося зберегти. Спробуйте ще раз.'})
        }
    }
    return (
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
            <p className='text-xs text-muted'>Місце: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>

            <div>
                <h3 className='rv-label mb-2'>Тип проблеми</h3>
                <div className='grid grid-cols-2 gap-2'>
                    {types?.filter((t) => !DEVICE_ONLY.includes(t.slug)).map((t) => (
                        <label key={t.id} className='relative cursor-pointer'>
                            <input type='radio' value={t.id} className='peer sr-only' {...register('typeId', {valueAsNumber: true})}/>
                            <span className='block rounded-xl border border-line px-3 py-2.5 text-center text-sm font-medium peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand'>
                                {t.label}
                            </span>
                        </label>
                    ))}
                </div>
                {errors.typeId && <p className='mt-1.5 text-sm text-sos'>{errors.typeId.message}</p>}
            </div>

            <div>
                <h3 className='rv-label mb-2'>Стан</h3>
                <div className='flex flex-col gap-1.5'>
                    {SEVERITY_ORDER.map((s) => {
                        const m = LEVEL_META[SEVERITY_LEVEL[s]]
                        const on = severity === s
                        return (
                            <label key={s} className='flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5'
                                   style={on ? {background: m.soft, borderColor: m.color} : {borderColor: '#e2e3dd'}}>
                                <input type='radio' value={s} className='sr-only' {...register('severity')}/>
                                <LevelIcon level={SEVERITY_LEVEL[s]} size={15}/>
                                <span className='font-semibold' style={{color: m.text}}>{m.label}</span>
                            </label>
                        )
                    })}
                </div>
                {errors.severity && <p className='mt-1.5 text-sm text-sos'>{errors.severity.message}</p>}
            </div>

            <div>
                <h3 className='rv-label mb-2'>Опис</h3>
                <textarea rows={3} placeholder='Що саме тут заважає?' {...register('description')}
                          className='w-full resize-y rounded-xl border border-line p-3 text-[15px] outline-none focus:border-brand'/>
                {errors.description && <p className='mt-1 text-sm text-sos'>{errors.description.message}</p>}
            </div>

            <div className='flex gap-2'>
                <button className={`${btn.primary} flex-1 py-3`} type='submit' disabled={isSubmitting}>Додати точку</button>
                {onCancel && <button type='button' className={btn.outline} onClick={onCancel}>Скасувати</button>}
            </div>
            {errors.root && <p role='alert' className='text-sm text-sos'>{errors.root.message}</p>}
        </form>
    )
}
