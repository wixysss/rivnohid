import {LuCheck, LuMic, LuRoute} from "react-icons/lu";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {type FeedStatus, useLiveFeed} from "../hooks/useLiveFeed.ts";
import {RoughnessGauge} from "../components/roughnessGauge.tsx";
import {WaveChart} from "../components/waveChart.tsx";
import {RoadStrip} from "../components/roadStrip.tsx";
import {EventList} from "../components/eventList.tsx";
import {LiveTrackMap} from "../components/liveTrackMap.tsx";
import {LiveEmptyState} from "../components/emptyState.tsx";
import type {DeviceDiag} from "../constants.ts";
import {SosBanner, SosMissingNotice} from "../components/sosBanner.tsx";
import {Card} from "../../../shared/ui/card.tsx";
import {CheckRow} from "../../../shared/ui/checkbox.tsx";
import {LevelIcon} from "../../../shared/ui/levelIcon.tsx";
import {LEVEL_META, LEVEL_ORDER} from "../../../shared/ui/levels.ts";

const STATUS: Record<FeedStatus, { text: string, tone: 'ok' | 'wait' | 'bad' | 'demo' }> = {
    connecting: {text: 'Підключення до сервера…', tone: 'wait'},
    waiting: {text: 'Очікуємо пристрій…', tone: 'wait'},
    offline: {text: 'Пристрій вимкнений або без інтернету', tone: 'wait'},
    lowBattery: {text: 'Пристрій заснув: розряджений акумулятор', tone: 'bad'},
    noSensor: {text: 'Пристрій онлайн, але датчик тряски не відповідає', tone: 'bad'},
    live: {text: 'Пристрій підключено', tone: 'ok'},
    demo: {text: 'Демо-дані', tone: 'demo'},
}
const TONE = {
    ok: 'bg-lvl-smooth-soft text-[#1554b3]',
    wait: 'bg-white border border-line text-muted',
    bad: 'bg-sos-soft text-sos',
    demo: 'bg-brand-soft text-brand',
}

const Stat = ({label, value, unit}: { label: string, value: string, unit?: string }) => (
    <div className='rounded-xl border border-line px-3.5 py-3'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.06em] text-muted'>{label}</div>
        <div className='mt-1 text-[22px] font-bold leading-tight tabular-nums'>
            {value}{unit && value !== '—' && <span className='ml-1 text-sm font-medium text-muted'>{unit}</span>}
        </div>
    </div>
)

const Legend = () => (
    <div className='flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink'>
        {LEVEL_ORDER.map((l) => (
            <span key={l} className='flex items-center gap-1.5'><LevelIcon level={l} size={11}/>{LEVEL_META[l].label}</span>
        ))}
    </div>
)

const Axis = ({labels}: { labels: string[] }) => (
    <div className='mt-2 flex justify-between pl-11 text-xs text-muted'>
        {labels.map((l) => <span key={l}>{l}</span>)}
    </div>
)

// Що підключено до пристрою
const DiagRow = ({diag}: { diag: DeviceDiag }) => {
    const items: [string, 0 | 1][] = [['Датчик тряски', diag.mpu], ['Мікрофон', diag.mic], ['SD-картка', diag.sd], ['Екран', diag.oled], ['Номер SOS', diag.sos]]
    return (
        <div className='mb-5 flex flex-wrap items-center gap-2 text-xs'>
            <span className='text-muted'>Пристрій v{diag.fw}{diag.ssid ? ` · ${diag.ssid}` : ''}</span>
            {items.map(([label, ok]) => (
                <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${ok ? 'bg-brand-soft text-brand' : 'bg-white text-faint line-through ring-1 ring-line'}`}>
                    {ok ? <LuCheck size={12} strokeWidth={3}/> : null}{label}
                </span>
            ))}
            {diag.stuck && <span className='rounded-full bg-lvl-uneven-soft px-2.5 py-1 font-medium text-[#8a5a00]'>Замкнена кнопка {diag.stuck}: перевір ніжки</span>}
            {diag.i2c != null && (!diag.oled || !diag.mpu) && <span className='text-muted'>На шині I2C: {diag.i2c || 'нікого'}</span>}
        </div>
    )
}

const batteryPct = (v?: number) => v != null && v > 3 && v < 4.4 ? Math.round(Math.max(0, Math.min(1, (v - 3.3) / 0.9)) * 100) : null

export const LivePage = () => {
    const {store, status, demo, setDemo, diag} = useLiveFeed()
    const s = STATUS[status]
    const hasData = status === 'live' || status === 'noSensor' || status === 'demo'
    const pct = batteryPct(store.bat)
    const pill = status === 'live'
        ? [s.text, store.lat != null ? 'GPS' : 'без GPS', pct != null ? `батарея ${pct} %` : null].filter(Boolean).join(' · ')
        : s.text

    return (
        <div className='min-h-full bg-page pb-24 md:pb-10'>
            <NavBar/>
            <main className='mx-auto max-w-[1280px] px-4 pt-6 md:px-8'>
                <div className='mb-5 flex flex-wrap items-center gap-3'>
                    <h1 className='text-[28px] font-bold tracking-tight'>Дорога наживо</h1>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${TONE[s.tone]}`}>
                        {s.tone === 'ok' ? <LuCheck size={15} strokeWidth={3}/> : <i className={`inline-block h-2 w-2 rounded-full ${s.tone === 'bad' ? 'bg-sos' : s.tone === 'demo' ? 'bg-brand' : 'bg-faint'}`}/>}
                        {pill}
                    </span>
                    {store.recording && (
                        <span className='inline-flex items-center gap-2 rounded-full bg-sos px-3 py-1.5 text-sm font-semibold text-white'>
                            <LuMic size={15}/> Йде запис голосу
                        </span>
                    )}
                    {store.trackOn && (
                        <span className='inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white'>
                            <LuRoute size={15}/> Пишеться GPS-маршрут
                        </span>
                    )}
                    {store.points > 0 && (
                        <span className='rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-line'>
                            Точок: {store.points}{store.linkPoint ? ` · голос піде в точку ${store.linkPoint}` : ''}
                        </span>
                    )}
                    <CheckRow className='ml-auto font-medium' checked={demo} onChange={setDemo}>Демо-режим</CheckRow>
                </div>

                {store.sos && <SosBanner sos={store.sos} onDismiss={() => { store.sos = null }}/>}
                <SosMissingNotice/>
                {diag && <DiagRow diag={diag}/>}

                {!hasData ? (
                    <LiveEmptyState statusText={s.text} onDemo={() => setDemo(true)}/>
                ) : (
                    <div className='grid gap-5 lg:grid-cols-[320px_1fr]'>
                        <div className='contents lg:flex lg:flex-col lg:gap-5'>
                            <Card title='Індекс нерівності'>
                                {status === 'noSensor'
                                    ? <p className='py-8 text-center text-sm text-muted'>Датчик тряски не відповідає: перевір дроти GY-521 (SDA → D21, SCL → D22). GPS і точки працюють.</p>
                                    : <RoughnessGauge rms={store.rms}/>}
                                <div className='mt-5 grid grid-cols-2 gap-2.5'>
                                    <Stat label='Ями' value={String(store.bumps)}/>
                                    <Stat label='Пік' value={store.peak.toFixed(2).replace('.', ',')} unit='G'/>
                                    <Stat label='Швидкість' value={store.speed != null ? String(Math.round(store.speed)) : '—'} unit='км/год'/>
                                    <Stat label='Супутники' value={store.sat != null ? String(store.sat) : '—'}/>
                                </div>
                            </Card>
                            <Card title='Події' className='max-lg:order-last'>
                                <EventList events={store.events}/>
                            </Card>
                        </div>

                        <div className='flex min-w-0 flex-col gap-5'>
                            <Card title='Вертикальний струс, G' right={<Legend/>}>
                                <WaveChart store={store}/>
                                <Axis labels={['−10 с', '−5 с', 'зараз']}/>
                            </Card>
                            <Card title='Стрічка дороги · 2 хвилини'>
                                <RoadStrip store={store}/>
                                <div className='mt-2 flex justify-between text-xs text-muted'><span>−2 хв</span><span>−1 хв</span><span>зараз</span></div>
                            </Card>
                            <Card title='Маршрут' right={<span className='text-[13px] text-muted'>Позиція оновлюється щосекунди</span>}>
                                <div className='h-72'>
                                    <LiveTrackMap track={store.track} events={store.events} lat={store.lat} lon={store.lon}/>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
