import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useMarkerTypes} from "../hooks/useMarkerTypes.ts";
import {useCreateMarker} from "../hooks/useCreateMarker.ts";
import {markerSchema, type MarkerValues} from "../schemas.ts";
import {MARKER_STYLES} from "../markerStyles.ts";
import type {Point} from "../types.ts";

type MarkerFormProps = {
    point:Point
    onSuccess: () => void
}
export const MarkerForm = ({point, onSuccess}: MarkerFormProps) => {
    const {
        register,
        handleSubmit,
        setError,
        formState: {errors, isSubmitting}
    } = useForm<MarkerValues>({resolver: zodResolver(markerSchema)})
    const {data: types} = useMarkerTypes()
    const {mutateAsync} = useCreateMarker()

    const onSubmit = async (values: MarkerValues) => {
        try {
            await mutateAsync({...values, ...point})
            onSuccess()
        } catch {
            setError('root',
                {message: 'Виникла помилка'})
        }
    }
    return (
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col justify-around gap-1 items-center border border-[#e9e9e9] rounded-xl p-5'>
            <label className='flex gap-1 justify-around border border-[#e9e9e9] p-3 rounded-lg w-full'>
                Виберіть зону:
                <select className='rounded-lg' {...register('typeId', {valueAsNumber: true})}>

                    <option value=''>Оберіть тип</option>
                    {types?.map((t) => (
                        <option value={t.id} key={t.id}>{t.label}</option>
                    ))}
                </select>
            </label>
            {errors.typeId && <p className='text-red-500'>{errors.typeId?.message}</p>}

            <label className='flex gap-1 justify-around border border-[#e9e9e9] p-3 rounded-lg w-full'>
                Виберіть колір:
                <select className='rounded-lg' {...register('severity')}>
                    {Object.entries(MARKER_STYLES).map(([key, style]) => (
                        <option key={key} value={key}>{style.label}</option>
                    ))}
                </select>
            </label>
            {errors.severity && <p className='text-red-500'>{errors.severity?.message}</p>}

            <label className='flex flex-col items-center p-3 border border-[#e9e9e9] rounded-lg w-full'>
                Опис
                <textarea className='w-full pl-2 pt-2 rounded-lg' {...register('description')}/>
            </label>

            {errors.description && <p className='text-red-500'>{errors.description?.message}</p>}

            <button className='mt-2 text-white cursor-pointer rounded-lg p-2 border border-[#e9e9e9] bg-[#2a78d6] w-full' type='submit' disabled={isSubmitting}>Додати</button>
            {errors.root && <p role='alert' className='text-red-500'>{errors.root?.message}</p>}
        </form>
    )
}