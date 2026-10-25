// Мінімальний MQTT 3.1.1 клієнт поверх WebSocket — лише підписка на топік.
// Без зовнішніх залежностей: браузерний WebSocket + кілька пакетів протоколу.

type Handlers = {
    onMessage: (topic: string, payload: Uint8Array) => void
    onStatus?: (connected: boolean) => void
}

const enc = new TextEncoder()
const dec = new TextDecoder()

const utf8 = (s: string) => {
    const b = enc.encode(s)
    return [b.length >> 8, b.length & 0xff, ...b]
}

const remainingLength = (n: number) => {
    const out: number[] = []
    do {
        let byte = n % 128
        n = Math.floor(n / 128)
        if (n > 0) byte |= 0x80
        out.push(byte)
    } while (n > 0)
    return out
}

const packet = (header: number, body: number[]) =>
    new Uint8Array([header, ...remainingLength(body.length), ...body])

export class MqttSubscriber {
    private ws: WebSocket | null = null
    private buf = new Uint8Array(0)
    private ping: ReturnType<typeof setInterval> | null = null
    private retry: ReturnType<typeof setTimeout> | null = null
    private closed = false
    private url: string
    private topic: string
    private handlers: Handlers

    constructor(url: string, topic: string, handlers: Handlers) {
        this.url = url
        this.topic = topic
        this.handlers = handlers
        this.open()
    }

    private open() {
        if (this.closed) return
        const ws = new WebSocket(this.url, 'mqtt')
        ws.binaryType = 'arraybuffer'
        this.ws = ws
        this.buf = new Uint8Array(0)

        ws.onopen = () => {
            const clientId = 'web-' + Math.random().toString(16).slice(2, 10)
            // CONNECT: protocol "MQTT", level 4, clean session, keepalive 30 s
            ws.send(packet(0x10, [...utf8('MQTT'), 4, 0x02, 0, 30, ...utf8(clientId)]))
        }
        ws.onmessage = (e) => this.feed(new Uint8Array(e.data as ArrayBuffer))
        ws.onclose = () => this.drop()
        ws.onerror = () => ws.close()
    }

    private drop() {
        if (this.ping) clearInterval(this.ping)
        this.ping = null
        this.handlers.onStatus?.(false)
        if (!this.closed) this.retry = setTimeout(() => this.open(), 3000)
    }

    private feed(chunk: Uint8Array) {
        const merged = new Uint8Array(this.buf.length + chunk.length)
        merged.set(this.buf)
        merged.set(chunk, this.buf.length)
        this.buf = merged

        for (;;) {
            if (this.buf.length < 2) return
            let len = 0, mult = 1, i = 1, byte
            do {
                if (i >= this.buf.length) return
                byte = this.buf[i++]
                len += (byte & 0x7f) * mult
                mult *= 128
            } while (byte & 0x80)
            if (this.buf.length < i + len) return
            this.handle(this.buf[0], this.buf.subarray(i, i + len))
            this.buf = this.buf.slice(i + len)
        }
    }

    private handle(header: number, body: Uint8Array) {
        const type = header >> 4
        if (type === 2) { // CONNACK
            if (body[1] !== 0) return this.ws?.close()
            this.handlers.onStatus?.(true)
            // SUBSCRIBE, packet id 1, QoS 0
            this.ws?.send(packet(0x82, [0, 1, ...utf8(this.topic), 0]))
            this.ping = setInterval(() => this.ws?.send(new Uint8Array([0xc0, 0])), 20000)
        } else if (type === 3) { // PUBLISH
            const qos = (header >> 1) & 3
            const tlen = (body[0] << 8) | body[1]
            const topic = dec.decode(body.subarray(2, 2 + tlen))
            const start = 2 + tlen + (qos > 0 ? 2 : 0)
            this.handlers.onMessage(topic, body.subarray(start))
        }
    }

    close() {
        this.closed = true
        if (this.retry) clearTimeout(this.retry)
        if (this.ping) clearInterval(this.ping)
        try {
            this.ws?.send(new Uint8Array([0xe0, 0]))
        } catch { /* already closed */ }
        this.ws?.close()
    }
}
