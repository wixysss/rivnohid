import type {OrsProfile} from "./requests.ts";

// Хто рухається: профіль OpenRouteService + наскільки сильно нерівності впливають на вибір маршруту
export type MoverId = 'wheelchair' | 'ewheelchair' | 'stroller' | 'bike'
export const MOVERS: { id: MoverId, label: string, ors: OrsProfile, weight: number }[] = [
    {id: 'wheelchair', label: 'Коляска', ors: 'wheelchair', weight: 1},
    {id: 'ewheelchair', label: 'Електроколяска', ors: 'wheelchair', weight: 0.7},
    {id: 'stroller', label: 'Дитяча коляска', ors: 'foot-walking', weight: 0.8},
    {id: 'bike', label: 'Велосипед', ors: 'cycling-regular', weight: 0.6},
]
