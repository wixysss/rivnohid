import {create} from "zustand";

const KEY = 'rv-demo'
const initial = () => {
    try {
        if (new URLSearchParams(location.search).has('demo')) return true
        return localStorage.getItem(KEY) === '1'
    } catch {
        return false
    }
}

// Демо-режим для всього сайту: пристрій, позначки й трек — вигадані, щоб показати роботу без заліза
export const useDemo = create<{ on: boolean, setOn: (on: boolean) => void, toggle: () => void }>((set, get) => ({
    on: initial(),
    setOn: (on) => {
        try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* приватний режим */ }
        set({on})
    },
    toggle: () => get().setOn(!get().on),
}))
