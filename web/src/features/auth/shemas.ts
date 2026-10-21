import { z } from 'zod'

export const registerSchema = z.object({
    displayName: z.string().trim().min(2, 'Minimum 2 characters'),
    email: z.email('Invalid email address'),
    password: z.string().min(6, 'Minimum 6 characters'),
})

export const loginSchema = registerSchema.pick({ email: true, password: true })

export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>