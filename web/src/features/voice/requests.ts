import {supabase} from "../../shared/lib/supabase.ts";

export type VoiceNote = {
    id: string
    lat: number | null
    lng: number | null
    duration_ms: number | null
    created_at: string
}

export const getVoiceNotes = async (): Promise<VoiceNote[]> => {
    const {data, error} = await supabase
        .from('voice_notes')
        .select('id, lat, lng, duration_ms, created_at')     // без самого аудіо
        .is('marker_id', null)                              // нотатки з точкою показує сама точка
        .order('created_at', {ascending: false})
        .limit(200)
    if (error) throw error
    return data
}

// Аудіо підтягуємо лише коли нотатку відкрили
export const getVoiceNoteAudioUrl = async (id: string): Promise<string> => {
    const {data, error} = await supabase.rpc('voice_note_audio', {p_id: id})
    if (error) throw error
    if (!data) throw new Error('Нотатку не знайдено')
    const bin = atob(data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}))
}

export const formatDuration = (ms: number | null) => {
    if (!ms) return ''
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
