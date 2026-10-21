import {supabase} from "../../shared/lib/supabase.ts";
import type {LoginValues, RegisterValues} from "./shemas.ts";



export const signIn = async (params:LoginValues) => {
    const {data,error} = await supabase.auth.signInWithPassword(params)
    if (error) throw error
    return data
}

export const signUp = async ({email, password, displayName}:RegisterValues) => {
    const {data,error} = await supabase.auth.signUp({email,password,options: { data: { display_name: displayName}}})
     if (error) throw error
    return data
}

export const signOut = async () => {
    const {error} = await supabase.auth.signOut()
    if (error) throw error
}
