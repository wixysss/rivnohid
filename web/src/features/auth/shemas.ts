import { z } from 'zod'

export const registerSchema = z.object({
    displayName: z.string().trim().min(2, 'Мінімум 2 символи'),
    email: z.email('Невірна адреса пошти'),
    password: z.string().min(6, 'Мінімум 6 символів'),
})

export const loginSchema = registerSchema.pick({ email: true, password: true })

export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>