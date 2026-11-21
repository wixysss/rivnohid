import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {MqttSubscriber} from "../mqttWs.ts";
import {MQTT_EVENT_TOPIC, MQTT_STATUS_TOPIC, MQTT_SUBSCRIBE, MQTT_TOPIC, MQTT_URL} from "../constants.ts";
import {DEMO_SPEED, demoDeviceAt, useDemoWorld} from "../../demo/demoWorld.ts";

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
                        const ev = JSON.parse(text) as { type: string, sent?: boolean, on?: boolean }
                        // Запис маршруту зупинили — за кілька секунд пристрій дошле останню пачку
                        if (ev.type === 'track' && !ev.on) setTimeout(() => void queryClient.invalidateQueries({queryKey: ['device-track']}), 6000)
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

    // Демо-режим: «пристрій» їде демо-кільцем; справжній, якщо він увімкнений, має перевагу
    const world = useDemoWorld()
    const [demoPos, setDemoPos] = useState<DevicePosition | null>(null)
    useEffect(() => {
        if (!world) return setDemoPos(null)
        const step = () => {
            const {p} = demoDeviceAt(world)
            setDemoPos({lat: p.lat, lng: p.lng, sat: 9, spd: DEMO_SPEED * 3.6, at: Date.now()})
        }
        step()
        const id = setInterval(step, 1000)
        return () => clearInterval(id)
    }, [world])
    if (!fresh && demoPos) return {pos: demoPos, lastPos: demoPos, online: true, demo: true}
    return {pos: fresh, lastPos: pos, online, demo: false}
}
