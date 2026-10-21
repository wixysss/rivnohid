import type {getMarkers} from "../requests.ts";
import {getSeverityStyle} from "../markerStyles.ts";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";
import {useDeleteMarker} from "../hooks/useDeleteMarker.ts";

type MarkerWithType = Awaited<ReturnType<typeof getMarkers>>[number]
export const MarkerPopup = ({marker}: { marker: MarkerWithType }) => {
    const session = useAuthStore((s) => s.session)
    const isOwner = session && session.user.id === marker.user_id
    const {mutate, isPending} = useDeleteMarker()

    const time = new Date(marker.created_at).toLocaleDateString('uk-UA')
    const style = getSeverityStyle(marker.severity)
    return (
        <div className='flex justify-around flex-col items-center pb-0'>
            <h3>{marker.marker_types.label}</h3>
            <p>{marker.description ?? 'Без опису'}</p>
            <span
                className={`${style.bg} text-white text-sm rounded-full px-2 py-0.5 inline-block `}>{style.label}</span>
            <div className='flex justify-between gap-1 mt-1'>
                <span className='text-xs'>{marker.profiles?.display_name ?? 'Без автора'}</span>
                <span className='text-xs'>{time}</span>
            </div>
            {isOwner && (
                <button
                    disabled={isPending}
                    className='w-full bg-red-500 rounded-lg mt-1 p-0.5 text-white'
                    onClick={() => mutate(marker.id)}
                >Delete
                </button>
            )}

        </div>
    )
}