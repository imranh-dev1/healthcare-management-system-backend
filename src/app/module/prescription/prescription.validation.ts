import { z } from "zod";

const medicineSchema = z.object({
    name: z
        .string({
            error: "Medicine name is required",
        })
        .min(1, "Medicine name cannot be empty"),

    dosage: z
        .string({
            error: "Dosage is required",
        })
        .min(1, "Dosage cannot be empty"),

    duration: z
        .string({
            error: "Duration is required",
        })
        .min(1, "Duration cannot be empty"),

    instructions: z
        .string()
        .optional(),
});

const createPrescriptionSchema = z.object({
    appointmentId: z
        .string({
            error: "Appointment ID is required",
        })
        .uuid("Invalid appointment ID"),

    finding: z
        .string({
            error: "Finding is required",
        })
        .min(1, "Finding cannot be empty"),

    medicines: z
        .array(medicineSchema)
        .min(1, "At least one medicine is required"),
});

export const PrescriptionValidation = {
    createPrescriptionSchema,
};
