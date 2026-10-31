import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {MqttSubscriber} from "../mqttWs.ts";
import {MQTT_EVENT_TOPIC, MQTT_STATUS_TOPIC, MQTT_SUBSCRIBE, MQTT_TOPIC, MQTT_URL} from "../constants.ts";

export type DevicePosition = { lat: number, lng: number, sat?: number, spd?: number, at: number }

// Лише координати пристрою наживо (без графіків) — для карти й навігатора.
// Нові точки й нотатки з пристрою одразу оновлюють карту.
export const useDevicePosition = () => {
    const [pos, setPos] = useState<DevicePosition | null>(null)
    const [online, setOnline] = useState(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        let last = 0
        const client = new MqttSubscriber(MQTT_URL, MQTT_SUBSCRIBE, {
            onMessage: (topic, payload) => {
                const text = new TextDecoder().decode(payload)
                if (topic === MQTT_STATUS_TOPIC) return setOnline(text !== 'offline' && text !== 'low_battery')
                if (topic === MQTT_EVENT_TOPIC) {
                    try {
                        const ev = JSON.parse(text) as { type: string, sent?: boolean }
                        if ((ev.type === 'point' && ev.sent) || ev.type === 'voice') {
                            void queryClient.invalidateQueries({queryKey: ['markers']})
                            void queryClient.invalidateQueries({queryKey: ['voice-notes']})
                        }
                    } catch { /* битий пакет */ }
                    return
                }
                if (topic !== MQTT_TOPIC) return
                const now = performance.now()
                if (now - last < 1000) return                 // позиції досить раз на секунду
                last = now
                try {
                    const p = JSON.parse(text) as { lat?: number, lon?: number, sat?: number, spd?: number }
                    setOnline(true)
                    if (p.lat != null && p.lon != null) setPos({lat: p.lat, lng: p.lon, sat: p.sat, spd: p.spd, at: Date.now()})
                } catch { /* битий пакет */ }
            },
        })
        return () => client.close()
    }, [queryClient])

    // Позиція старша за 30 с — вже не «зараз»
    const [, tick] = useState(0)
    useEffect(() => {
        const id = setInterval(() => tick((n) => n + 1), 5000)
        return () => clearInterval(id)
    }, [])
    const fresh = pos && Date.now() - pos.at < 30000 ? pos : null
    return {pos: fresh, lastPos: pos, online}
}
