import {useEffect, useRef, useState} from "react";
import {LiveStore} from "../liveStore.ts";
import {MqttSubscriber} from "../mqttWs.ts";
import {type LivePacket, MQTT_TOPIC, MQTT_URL, OFFLINE_AFTER_MS} from "../constants.ts";
import {startDemo} from "../demoSource.ts";

export type FeedStatus = 'connecting' | 'waiting' | 'live' | 'demo'

// Підключення до пристрою через MQTT + демо-режим.
// Дані лежать у LiveStore (ref), а React перемальовується ~5 разів на секунду.
export const useLiveFeed = () => {
    const storeRef = useRef(new LiveStore())
    const [demo, setDemo] = useState(() => new URLSearchParams(location.search).has('demo'))
    const [brokerUp, setBrokerUp] = useState(false)
    const [, setTick] = useState(0)

    useEffect(() => {
        const store = storeRef.current
        store.reset()
        if (demo) return startDemo((p) => store.push(p))

        const client = new MqttSubscriber(MQTT_URL, MQTT_TOPIC, {
            onStatus: setBrokerUp,
            onMessage: (_, payload) => {
                try {
                    store.push(JSON.parse(new TextDecoder().decode(payload)) as LivePacket)
                } catch {
                    /* битий пакет — пропускаємо */
                }
            },
        })
        return () => client.close()
    }, [demo])

    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 200)
        return () => clearInterval(id)
    }, [])

    const store = storeRef.current
    const fresh = store.lastPacketAt > 0 && performance.now() - store.lastPacketAt < OFFLINE_AFTER_MS
    const status: FeedStatus = demo ? 'demo' : fresh ? 'live' : brokerUp ? 'waiting' : 'connecting'

    return {store, status, demo, setDemo}
}
