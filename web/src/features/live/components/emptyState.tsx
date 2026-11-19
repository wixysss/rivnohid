import {useState} from "react";
import {LuActivity} from "react-icons/lu";
import {btn} from "../../../shared/ui/card.tsx";

const Device = () => (
    <svg viewBox='0 0 150 110' className='w-36 shrink-0' fill='none' stroke='#173d33' strokeWidth='4' strokeLinecap='round' strokeLinejoin='round' aria-hidden>
        <rect x='8' y='38' width='134' height='64' rx='12'/>
        <circle cx='34' cy='70' r='7' stroke='#8a948f'/>
        <path d='M54 63h52M54 77h36' stroke='#c4c8c2' strokeWidth='6'/>
        <path d='M104 38V14M96 21l8-8 8 8'/>
    </svg>
)

const STEPS = [
    'Увімкни пристрій на вулиці — йому потрібно кілька секунд для GPS.',
    'Дочекайся статусу «Пристрій підключено».',
    'Їдь — дорога сама пофарбується кольором і формою стану покриття.',
]

// Порожній стан сторінки «Наживо»: пристрій ще не надсилав даних
export const LiveEmptyState = ({statusText, onDemo}: { statusText: string, onDemo: () => void }) => {
    const [help, setHelp] = useState(false)
    return (
        <div className='mx-auto mt-6 max-w-3xl rounded-3xl border border-line bg-white p-6 md:p-8'>
            <div className='flex flex-col items-center gap-8 md:flex-row md:items-start'>
                <Device/>
                <div className='flex-1'>
                    <span className='inline-flex items-center gap-2 rounded-full bg-page px-3 py-1.5 text-sm font-semibold'>
                        <i className='inline-block h-2.5 w-2.5 rounded-full border-2 border-faint'/>{statusText}
                    </span>
                    <h2 className='mt-3 text-[26px] font-bold leading-tight'>Пристрій ще не підключено</h2>
                    <ol className='mt-4 space-y-3'>
                        {STEPS.map((s, i) => (
                            <li key={i} className='flex gap-3 text-[15px]'>
                                <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand'>{i + 1}</span>
                                <span className='pt-0.5'>{s}</span>
                            </li>
                        ))}
                    </ol>
                    <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                        <button className={`${btn.primary} py-3`} onClick={onDemo}><LuActivity size={18}/> Запустити демо</button>
                        <button className={`${btn.outline} py-3`} onClick={() => setHelp((v) => !v)}>Як підключити</button>
                    </div>
                    {help && (
                        <ul className='mt-4 list-disc space-y-1.5 rounded-2xl bg-page p-4 pl-8 text-sm text-muted'>
                            <li>Пристрій під'єднується до Wi-Fi «Home 2.4G» або до точки доступу телефона «iPhone 15» (на iPhone відкрий екран «Режим модема»).</li>
                            <li>Після ввімкнення світлодіод блимає червоним, зеленим і синім, а за 5–20 с стає зеленим — пристрій онлайн.</li>
                            <li>Якщо світлодіод жовтий — є Wi-Fi, але немає зв'язку з сервером: перевір інтернет на точці доступу.</li>
                            <li>GPS ловить лише надворі; перший фікс займає 1–15 хвилин. Графіки працюють і без нього.</li>
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
