import z from "zod";

const registerPatientSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters long")
        .max(100, "Name cannot exceed 100 characters"),

    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Please provide a valid email address"),

    password: z
        .string()
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character"),

    patient: z.object({
        contactNumber : z.string().optional()
    }).optional()
}); 

export const loginPatientSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Please provide a valid email address"),

    password: z
        .string()
        .min(1, "Password is required"),
});
 

export const userValidation = {
    registerPatientSchema,
    loginPatientSchema
}