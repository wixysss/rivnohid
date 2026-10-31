import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import type {getMarkers} from "../requests.ts";
import {deletePoint, setPointNote} from "../requests.ts";
import {getSeverityStyle} from "../markerStyles.ts";
import {useAuthStore} from "../../auth/store/useAuthStore.ts";
import {VoicePlayer} from "../../voice/components/voicePlayer.tsx";
import {formatDuration} from "../../voice/requests.ts";

type MarkerRow = Awaited<ReturnType<typeof getMarkers>>[number]

const ROAD: Record<string, string> = {ok: 'Дорога рівна', warning: 'Дорога нерівна', bad: 'Дорога погана'}

// Точка з пристрою (кнопка 3): стан дороги, голосові нотатки, текст, який можна дописати на сайті
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

    const style = getSeverityStyle(marker.severity)
    const voices = [...(marker.voice_notes ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const changed = text.trim() !== (marker.description ?? '')

    return (
        <div className='flex w-60 flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
                <h3 className='font-medium'>Точка з пристрою</h3>
                <span className={`${style.bg} rounded-full px-2 py-0.5 text-xs text-white`}>{ROAD[marker.severity] ?? style.label}</span>
            </div>
            <span className='text-xs text-zinc-500'>{new Date(marker.created_at).toLocaleString('uk-UA')}</span>

            {voices.map((v, i) => (
                <div key={v.id} className='rounded-lg bg-violet-50 p-2'>
                    <button className='flex w-full items-center justify-between text-sm text-violet-800'
                            onClick={() => setOpenVoice(openVoice === v.id ? null : v.id)}>
                        <span>Голос {voices.length > 1 ? i + 1 : ''} · {formatDuration(v.duration_ms)}</span>
                        <span>{openVoice === v.id ? 'Сховати' : 'Слухати'}</span>
                    </button>
                    {openVoice === v.id && <div className='mt-1'><VoicePlayer id={v.id}/></div>}
                </div>
            ))}

            {editing ? (
                <>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} autoFocus
                              placeholder='Що тут? Сходинка, поребрик, вузький тротуар…'
                              className='w-full resize-y rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-[#2a78d6]'/>
                    <div className='flex gap-2'>
                        <button disabled={save.isPending || !changed}
                                onClick={() => save.mutate({id: marker.id, note: text})}
                                className='flex-1 rounded-lg bg-[#2a78d6] py-1 text-sm text-white disabled:opacity-50'>
                            {save.isPending ? 'Зберігаю…' : 'Зберегти'}
                        </button>
                        <button onClick={() => { setText(marker.description ?? ''); setEditing(false) }}
                                className='rounded-lg border border-zinc-300 px-3 py-1 text-sm'>Скасувати</button>
                    </div>
                    {save.error && <p className='text-xs text-red-500'>{save.error.message}</p>}
                </>
            ) : (
                <>
                    <p className={`whitespace-pre-wrap text-sm ${marker.description ? '' : 'text-zinc-400'}`}>
                        {marker.description || (voices.length ? 'Тексту ще немає' : 'Порожня точка')}
                    </p>
                    {session ? (
                        <div className='flex gap-2'>
                            <button onClick={() => setEditing(true)}
                                    className='flex-1 rounded-lg border border-[#2a78d6] py-1 text-sm text-[#2a78d6]'>
                                {marker.description ? 'Редагувати текст' : 'Написати нотатку'}
                            </button>
                            <button disabled={remove.isPending}
                                    onClick={() => { if (confirm('Видалити точку разом з голосом?')) remove.mutate(marker.id) }}
                                    className='rounded-lg bg-red-500 px-3 py-1 text-sm text-white disabled:opacity-50'>
                                Видалити
                            </button>
                        </div>
                    ) : (
                        <Link to='/login' className='text-center text-sm text-[#2a78d6]'>Увійдіть, щоб писати нотатки</Link>
                    )}
                    {remove.error && <p className='text-xs text-red-500'>{remove.error.message}</p>}
                </>
            )}
        </div>
    )
}
