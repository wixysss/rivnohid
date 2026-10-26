import {supabase} from "../../shared/lib/supabase.ts";

export type SosSettings = { sos_phone: string | null, sos_name: string | null, updated_at?: string }

export const getSosSettings = async (): Promise<SosSettings | null> => {
    const {data, error} = await supabase.rpc('get_sos_settings')
    if (error) throw error
    return data
}

export const setSosSettings = async (name: string, phone: string) => {
    const {error} = await supabase.rpc('set_sos_settings', {p_name: name, p_phone: phone})
    if (error) throw error
}

// Номер у форматі, який зрозуміє SIM800L і посилання tel:
export const normalizePhone = (raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '')
    if (/^0\d{9}$/.test(digits)) return '+38' + digits          // 0501234567 -> +380501234567
    if (/^380\d{9}$/.test(digits)) return '+' + digits
    return digits
}
