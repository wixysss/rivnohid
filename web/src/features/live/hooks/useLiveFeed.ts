import {useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {LiveStore} from "../liveStore.ts";
import {MqttSubscriber} from "../mqttWs.ts";
import {type DeviceDiag, type DeviceEvent, type LivePacket, MQTT_DIAG_TOPIC, MQTT_EVENT_TOPIC, MQTT_STATUS_TOPIC, MQTT_SUBSCRIBE, MQTT_TOPIC, MQTT_URL, OFFLINE_AFTER_MS} from "../constants.ts";
import {startDemo} from "../demoSource.ts";

export type FeedStatus = 'connecting' | 'waiting' | 'offline' | 'lowBattery' | 'noSensor' | 'live' | 'demo'

// Підключення до пристрою через MQTT + демо-режим.
// Дані лежать у LiveStore (ref), а React перемальовується ~5 разів на секунду.
export const useLiveFeed = () => {
    const storeRef = useRef(new LiveStore())
    const [demo, setDemo] = useState(() => new URLSearchParams(location.search).has('demo'))
    const [brokerUp, setBrokerUp] = useState(false)
    // Стан, який пристрій сам публікує (retained), брокер ставить "offline", якщо пристрій зник
    const [deviceState, setDeviceState] = useState<string | null>(null)
    const [diag, setDiag] = useState<DeviceDiag | null>(null)
    const [, setTick] = useState(0)
    const queryClient = useQueryClient()

    useEffect(() => {
        const store = storeRef.current
        store.reset()
        if (demo) return startDemo((p) => store.push(p))

        const client = new MqttSubscriber(MQTT_URL, MQTT_SUBSCRIBE, {
            onStatus: setBrokerUp,
            onMessage: (topic, payload) => {
                const text = new TextDecoder().decode(payload)
                if (topic === MQTT_STATUS_TOPIC) return setDeviceState(text)
                if (topic === MQTT_DIAG_TOPIC) {
                    try {
                        setDiag(JSON.parse(text) as DeviceDiag)
                    } catch {
                        /* битий пакет */
                    }
                    return
                }
                if (topic === MQTT_EVENT_TOPIC) {
                    try {
                        const ev = JSON.parse(text) as DeviceEvent
                        store.handleEvent(ev)
                        if (ev.type === 'voice') void queryClient.invalidateQueries({queryKey: ['voice-notes']})
                        if (ev.type === 'marker') void queryClient.invalidateQueries({queryKey: ['markers']})
                    } catch {
                        /* битий пакет */
                    }
                    return
                }
                if (topic !== MQTT_TOPIC) return
                try {
                    store.push(JSON.parse(text) as LivePacket)
                } catch {
                    /* битий пакет — пропускаємо */
                }
            },
        })
        return () => client.close()
    }, [demo, queryClient])

    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 200)
        return () => clearInterval(id)
    }, [])

    const store = storeRef.current
    const fresh = store.lastPacketAt > 0 && performance.now() - store.lastPacketAt < OFFLINE_AFTER_MS
    const status: FeedStatus = demo ? 'demo'
        : fresh ? 'live'
            : !brokerUp ? 'connecting'
                : deviceState === 'low_battery' ? 'lowBattery'
                    : deviceState === 'offline' ? 'offline'
                        : deviceState === 'no_sensor' || deviceState === 'sensor_error' ? 'noSensor'
                            : 'waiting'

    return {store, status, demo, setDemo, diag: demo ? null : diag}
}
