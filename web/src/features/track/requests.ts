import {supabase} from "../../shared/lib/supabase.ts";

// Точка треку пристрою: координата, струс (RMS, g) і час
export type TrackSample = { lat: number, lng: number, rms: number, t: number }

export const getDeviceTrack = async (days = 30): Promise<TrackSample[]> => {
    const {data, error} = await supabase.rpc('get_device_track', {p_days: days})
    if (error) throw error
    return (data ?? []).map(([lat, lng, rms, t]) => ({lat, lng, rms, t}))
}
