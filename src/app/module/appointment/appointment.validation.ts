import z from "zod";

export const BookAppointmentValidationZodSchema = z.object({
    scheduleId: z.string().min(1, "Schdule Id Is Required.")
})

export const UpdateAppointmentStatusValidationZodSchema = z.object({
    status: z.enum(["ONGOING", "COMPLETED"], "Status Must Be Either ONGOING Or COMPLETED")
})