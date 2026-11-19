import {z} from "zod";

export const markerSchema = z.object({
    severity: z.enum(['ok','warning','bad'],'Оберіть стан'),
    typeId: z.number('Оберіть тип').positive().int(),
    description: z.string().trim().max(500,'Максимум 500 символів')
})

export type MarkerValues = z.infer<typeof markerSchema>