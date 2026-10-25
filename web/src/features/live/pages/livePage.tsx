import * as React from "react";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {type FeedStatus, useLiveFeed} from "../hooks/useLiveFeed.ts";
import {RoughnessGauge} from "../components/roughnessGauge.tsx";
import {WaveChart} from "../components/waveChart.tsx";
import {RoadStrip} from "../components/roadStrip.tsx";
import {EventList} from "../components/eventList.tsx";
import {LiveTrackMap} from "../components/liveTrackMap.tsx";
import {LEVELS} from "../constants.ts";

const STATUS: Record<FeedStatus, { text: string, dot: string }> = {
    connecting: {text: 'Підключення до сервера…', dot: 'bg-zinc-400'},
    waiting: {text: 'Чекаю на пристрій…', dot: 'bg-yellow-400'},
    offline: {text: 'Пристрій вимкнений або без інтернету', dot: 'bg-zinc-400'},
    lowBattery: {text: 'Пристрій заснув: розряджений акумулятор', dot: 'bg-red-500'},
    noSensor: {text: 'Пристрій онлайн, але акселерометр не відповідає: перевір дроти GY-521', dot: 'bg-red-500'},
    live: {text: 'Пристрій онлайн', dot: 'bg-green-500 animate-pulse'},
    demo: {text: 'Демо-дані', dot: 'bg-[#2a78d6]'},
}

const Card = ({title, right, children, className = ''}: {
    title: string, right?: React.ReactNode, children: React.ReactNode, className?: string
}) => (
    <section className={`rounded-xl border border-zinc-200 bg-white p-4 ${className}`}>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
            <h2 className='text-sm font-medium uppercase tracking-wide text-zinc-500'>{title}</h2>
            {right}
        </div>
        {children}
    </section>
)

const Stat = ({label, value}: { label: string, value: string }) => (
    <div className='rounded-lg border border-zinc-200 px-3 py-2'>
        <div className='text-xs uppercase tracking-wide text-zinc-500'>{label}</div>
        <div className='text-xl font-medium tabular-nums'>{value}</div>
    </div>
)

const Legend = () => (
    <div className='flex flex-wrap gap-3 text-xs text-zinc-500'>
        {Object.values(LEVELS).map((l) => (
            <span key={l.label} className='flex items-center gap-1'>
                <i className='inline-block h-2.5 w-2.5 rounded-sm' style={{background: l.color}}/>{l.label}
            </span>
        ))}
    </div>
)

const Axis = ({labels}: { labels: string[] }) => (
    <div className='mt-1 flex justify-between text-xs text-zinc-400'>
        {labels.map((l) => <span key={l}>{l}</span>)}
    </div>
)

export const LivePage = () => {
    const {store, status, demo, setDemo} = useLiveFeed()
    const s = STATUS[status]

    return (
        <div className='min-h-screen bg-zinc-50'>
            <NavBar/>
            <main className='mx-auto max-w-6xl px-4 pb-10'>
                <div className='mb-4 flex flex-wrap items-center gap-3'>
                    <h1 className='text-2xl font-semibold'>Дорога наживо</h1>
                    <span className='flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm'>
                        <i className={`inline-block h-2.5 w-2.5 rounded-full ${s.dot}`}/>{s.text}
                    </span>
                    <button onClick={() => setDemo((d) => !d)}
                            className={`ml-auto rounded-lg px-4 py-1.5 text-sm ${demo ? 'bg-[#2a78d6] text-white' : 'border border-zinc-200 bg-white'}`}>
                        {demo ? 'Вимкнути демо' : 'Демо-режим'}
                    </button>
                </div>

                <div className='grid gap-4 lg:grid-cols-[300px_1fr]'>
                    <div className='contents lg:flex lg:flex-col lg:gap-4'>
                        <Card title='Індекс нерівності'>
                            <RoughnessGauge rms={store.rms}/>
                            <div className='mt-4 grid grid-cols-2 gap-2'>
                                <Stat label='Ями' value={String(store.bumps)}/>
                                <Stat label='Пік, g' value={store.peak.toFixed(2)}/>
                                <Stat label='Швидкість' value={store.speed != null ? `${store.speed.toFixed(1)} км/г` : '—'}/>
                                <Stat label='Супутники' value={store.sat != null ? String(store.sat) : '—'}/>
                            </div>
                            {store.bat != null && store.bat > 2.5 && (
                                <p className='mt-3 text-xs text-zinc-500'>Акумулятор: {store.bat.toFixed(2)} В</p>
                            )}
                        </Card>
                        <Card title='Події' className='max-lg:order-last'>
                            <EventList events={store.events}/>
                        </Card>
                    </div>

                    <div className='flex min-w-0 flex-col gap-4'>
                        <Card title='Вертикальний струс, g' right={<Legend/>}>
                            <WaveChart store={store}/>
                            <Axis labels={['−10 с', '−5 с', 'зараз']}/>
                        </Card>
                        <Card title='Стрічка дороги · 2 хвилини'>
                            <RoadStrip store={store}/>
                            <Axis labels={['−2 хв', '−1 хв', 'зараз']}/>
                        </Card>
                        <Card title='Маршрут' className='flex flex-col'>
                            <div className='h-80'>
                                <LiveTrackMap track={store.track} events={store.events} lat={store.lat} lon={store.lon}/>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
