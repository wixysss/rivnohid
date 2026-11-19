import {useEffect, useState} from "react";
import {getVoiceNoteAudioUrl} from "../requests.ts";

// Програвач голосової нотатки: аудіо завантажується при першому відкритті
export const VoicePlayer = ({id}: { id: string }) => {
    const [url, setUrl] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let alive = true
        let created: string | null = null
        getVoiceNoteAudioUrl(id)
            .then((u) => {
                created = u
                if (alive) setUrl(u)
                else URL.revokeObjectURL(u)
            })
            .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Помилка'))
        return () => {
            alive = false
            if (created) URL.revokeObjectURL(created)
        }
    }, [id])

    if (error) return <p className='text-xs text-sos'>{error}</p>
    if (!url) return <p className='text-xs text-muted'>Завантажую запис…</p>
    return <audio controls autoPlay={false} src={url} className='h-10 w-full min-w-56'/>
}
