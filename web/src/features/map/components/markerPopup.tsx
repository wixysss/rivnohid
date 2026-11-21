import {LuTrash2} from "react-icons/lu";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";
import {useDeleteMarker} from "../hooks/useDeleteMarker.ts";
import {LevelBadge} from "../../../shared/ui/levelIcon.tsx";
import {levelOfSeverity} from "../../../shared/ui/levels.ts";
import type {MarkerRow} from "./mapView.tsx";
import {isDemoId} from "../../demo/demoWorld.ts";

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', {day: 'numeric', month: 'long'})

// Картка позначки, яку додали люди на сайті
export const MarkerPopup = ({marker}: { marker: MarkerRow }) => {
    const session = useAuthStore((s) => s.session)
    const isOwner = session && session.user.id === marker.user_id
    const {mutate, isPending} = useDeleteMarker()

    return (
        <div className='flex flex-col gap-2'>
            <div><LevelBadge level={levelOfSeverity(marker.severity)}/></div>
            <h3 className='pr-6 text-[17px] font-bold leading-snug text-ink'>{marker.marker_types?.label ?? 'Позначка'}</h3>
            {marker.description && <p className='text-sm text-ink'>{marker.description}</p>}
            <p className='text-xs text-muted'>
                Додано {fmtDate(marker.created_at)}
                {marker.profiles?.display_name ? ` · ${marker.profiles.display_name}` : marker.source === 'device' ? ' · з пристрою' : ''}
            </p>
            <p className='text-xs text-faint'>{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</p>
            {isDemoId(String(marker.id)) && <p className='rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand'>Демо-позначка</p>}
            {isOwner && (
                <button disabled={isPending} onClick={() => mutate(marker.id)}
                        className='mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-sos hover:bg-sos-soft disabled:opacity-50'>
                    <LuTrash2 size={15}/> Видалити
                </button>
            )}
        </div>
    )
}
