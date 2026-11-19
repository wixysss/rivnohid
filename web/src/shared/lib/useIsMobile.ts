import {useEffect, useState} from "react";

const q = '(max-width: 767px)'

export const useIsMobile = () => {
    const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
    useEffect(() => {
        const mq = window.matchMedia(q)
        const on = () => setM(mq.matches)
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [])
    return m
}
