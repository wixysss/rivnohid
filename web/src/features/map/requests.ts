import {supabase} from "../../shared/lib/supabase.ts";
import type {MarkerValues} from "./schemas.ts";

export const getMarkers = async () => {
    const {data, error} = await supabase.from('markers')
        .select('*, marker_types(slug, label), profiles(display_name), voice_notes(id, duration_ms, created_at)')
    if (error) throw error
    return data
}

// Точка з пристрою (кнопка 3): текст нотатки і видалення
export const setPointNote = async ({id, note}: { id: string, note: string }) => {
    const {error} = await supabase.rpc('set_point_note', {p_id: id, p_note: note})
    if (error) throw error
}

export const deletePoint = async (id: string) => {
    const {error} = await supabase.rpc('delete_point', {p_id: id})
    if (error) throw error
}

export const getMarkerTypes = async () => {
    const {data, error} = await supabase.from('marker_types').select('*')
    if (error) throw error
    return data
}

export const createMarker = async (values: MarkerValues & { lat: number; lng: number }) => {
    const {error} = await supabase.from('markers').insert({
        type_id: values.typeId,
        lat: values.lat,
        lng: values.lng,
        severity: values.severity,
        description: values.description || null
    })
    if (error) throw error
}

export const deleteMarker = async (id: string) => {
    const {error} = await supabase.from('markers').delete().eq('id', id)
    if (error) throw error
}