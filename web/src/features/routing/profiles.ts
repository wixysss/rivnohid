import type {OrsProfile} from "./requests.ts";

// Хто рухається: профіль OpenRouteService + наскільки сильно нерівності впливають на вибір маршруту
export type MoverId = 'wheelchair' | 'ewheelchair' | 'stroller' | 'bike'
// speed — швидкість у демо-поїздці, м/с
export const MOVERS: { id: MoverId, label: string, ors: OrsProfile, weight: number, speed: number }[] = [
    {id: 'wheelchair', label: 'Коляска', ors: 'wheelchair', weight: 1, speed: 1.1},
    {id: 'ewheelchair', label: 'Електроколяска', ors: 'wheelchair', weight: 0.7, speed: 1.8},
    {id: 'stroller', label: 'Дитяча коляска', ors: 'foot-walking', weight: 0.8, speed: 1.3},
    {id: 'bike', label: 'Велосипед', ors: 'cycling-regular', weight: 0.6, speed: 4.2},
]
