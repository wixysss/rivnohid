import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {LuCheck, LuMic, LuPencil, LuTrash2} from "react-icons/lu";
import {deletePoint, setPointNote} from "../requests.ts";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";
import {VoicePlayer} from "../../voice/components/voicePlayer.tsx";
import {formatDuration} from "../../voice/requests.ts";
import {LevelBadge} from "../../../shared/ui/levelIcon.tsx";
import {levelOfSeverity} from "../../../shared/ui/levels.ts";
import {fmtDate} from "./markerPopup.tsx";
import type {MarkerRow} from "./mapView.tsx";
import {isDemoId} from "../../demo/demoWorld.ts";

// Точка з пристрою (кнопка 3): стан дороги, голос, текст, який можна дописати на сайті
export const PointPopup = ({marker}: { marker: MarkerRow }) => {
    const session = useAuthStore((s) => s.session)
    const queryClient = useQueryClient()
    const [text, setText] = useState(marker.description ?? '')
    const [editing, setEditing] = useState(false)
    const [openVoice, setOpenVoice] = useState<string | null>(null)

    const save = useMutation({
        mutationFn: setPointNote,
        onSuccess: () => {
            setEditing(false)
            void queryClient.invalidateQueries({queryKey: ['markers']})
        },
    })
    const remove = useMutation({
        mutationFn: deletePoint,
        onSuccess: () => {
            void queryClient.invalidateQueries({queryKey: ['markers']})
            void queryClient.invalidateQueries({queryKey: ['voice-notes']})
        },
    })

    const voices = [...(marker.voice_notes ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const changed = text.trim() !== (marker.description ?? '')

    return (
        <div className='flex flex-col gap-2'>
            <div><LevelBadge level={levelOfSeverity(marker.severity)}/></div>
            <h3 className='pr-6 text-[17px] font-bold leading-snug text-ink'>Точка з пристрою</h3>
            <p className='text-xs text-muted'>Додано {fmtDate(marker.created_at)}, {new Date(marker.created_at).toLocaleTimeString('uk-UA', {hour: '2-digit', minute: '2-digit'})}</p>

            {voices.map((v, i) => (
                <div key={v.id} className='rounded-xl bg-page p-2.5'>
                    <button className='flex w-full items-center gap-2 text-sm font-medium text-ink'
                            onClick={() => setOpenVoice(openVoice === v.id ? null : v.id)}>
                        <LuMic size={15} className='text-brand'/>
                        Голос{voices.length > 1 ? ` ${i + 1}` : ''} · {formatDuration(v.duration_ms)}
                        <span className='ml-auto text-xs font-semibold text-brand'>{openVoice === v.id ? 'Сховати' : 'Слухати'}</span>
                    </button>
                    {openVoice === v.id && <div className='mt-2'><VoicePlayer id={v.id}/></div>}
                </div>
            ))}

            {editing ? (
                <>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} autoFocus
                              placeholder='Що тут? Сходинка, поребрик, вузький тротуар…'
                              className='w-full resize-y rounded-xl border border-line p-2.5 text-sm outline-none focus:border-brand'/>
                    <div className='flex gap-2'>
                        <button disabled={save.isPending || !changed} onClick={() => save.mutate({id: marker.id, note: text})}
                                className='inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50'>
                            <LuCheck size={15}/>{save.isPending ? 'Зберігаю…' : 'Зберегти'}
                        </button>
                        <button onClick={() => { setText(marker.description ?? ''); setEditing(false) }}
                                className='rounded-xl border border-line px-3 py-2 text-sm font-semibold'>Скасувати</button>
                    </div>
                    {save.error && <p className='text-xs text-sos'>{save.error.message}</p>}
                </>
            ) : (
                <>
                    <p className={`whitespace-pre-wrap text-sm ${marker.description ? 'text-ink' : 'text-faint'}`}>
                        {marker.description || (voices.length ? 'Тексту ще немає' : 'Порожня точка')}
                    </p>
                    {isDemoId(String(marker.id)) ? (
                        <p className='rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand'>Демо-точка: показує, як виглядає позначка з кнопки 3</p>
                    ) : session ? (
                        <div className='mt-1 flex gap-2'>
                            <button onClick={() => setEditing(true)}
                                    className='inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-semibold text-white'>
                                <LuPencil size={14}/>{marker.description ? 'Редагувати' : 'Написати нотатку'}
                            </button>
                            <button aria-label='Видалити точку' disabled={remove.isPending}
                                    onClick={() => { if (confirm('Видалити точку разом з голосом?')) remove.mutate(marker.id) }}
                                    className='grid w-10 place-items-center rounded-xl border border-line text-sos hover:bg-sos-soft disabled:opacity-50'>
                                <LuTrash2 size={16}/>
                            </button>
                        </div>
                    ) : (
                        <Link to='/login' className='text-sm font-semibold text-brand underline'>Увійдіть, щоб писати нотатки</Link>
                    )}
                    {remove.error && <p className='text-xs text-sos'>{remove.error.message}</p>}
                </>
            )}
        </div>
    )
}
