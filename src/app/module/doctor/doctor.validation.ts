import { z } from "zod";
import { DoctorVerificationStatus } from "../../../generated/prisma/enums";

export const ApplyingAsDoctorValidationSchema = z.object({
    user: z.object({
        name: z
            .string()
            .trim()
            .min(2, "Name must be at least 2 characters long.")
            .max(100, "Name must not exceed 100 characters."),

        email: z
            .string()
            .trim()
            .email("Please provide a valid email address.")
            .toLowerCase(),
    }),

    doctor: z.object({
        address: z
            .string()
            .trim()
            .max(255, "Address must not exceed 255 characters.")
            .optional()
            .nullable(),

        specialization: z
            .string()
            .trim()
            .min(2, "Specialization is required.")
            .max(100, "Specialization must not exceed 100 characters."),

        licenseNumber: z
            .string()
            .trim()
            .min(3, "License number is required.")
            .max(100, "License number must not exceed 100 characters."),

        qualification: z
            .string()
            .trim()
            .min(2, "Qualification is required.")
            .max(255, "Qualification must not exceed 255 characters."),

        experinenceYears: z
            .coerce
            .number()
            .int("Experience years must be a whole number.")
            .min(0, "Experience years cannot be negative.")
            .max(70, "Experience years cannot exceed 70."),

        bio: z
            .string()
            .trim()
            .max(1000, "Bio must not exceed 1000 characters.")
            .optional()
            .nullable(),

        consultationFee: z
            .coerce
            .number()
            .min(0, "Consultation fee cannot be negative.")
            .optional()
            .nullable(),

        contactNumber: z
            .string()
            .trim()
            .regex(
                /^(\+8801|01)[3-9]\d{8}$/,
                "Please provide a valid Bangladesh contact number."
            )
            .optional()
            .nullable(),
    }),
});


export const ApproveDoctorValidationSchema = z.object({
    doctorId: z
        .string()
        .uuid("Invalid doctor ID."),

    verificationStatus: z.enum(DoctorVerificationStatus, {
        message: "Invalid doctor verification status.",
    }),

    rejectionReason: z
        .string()
        .trim()
        .max(500, "Rejection reason must not exceed 500 characters.")
        .optional()
});

const updateDoctorSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .optional(),

    address: z
        .string()
        .max(255, "Address cannot exceed 255 characters")
        .optional(),

    specialization: z
        .string()
        .min(2, "Specialization must be at least 2 characters")
        .max(100, "Specialization cannot exceed 100 characters")
        .optional(),

    qualification: z
        .string()
        .min(2, "Qualification must be at least 2 characters")
        .max(150, "Qualification cannot exceed 150 characters")
        .optional(),

    experinenceYears: z
        .number()
        .int("Experience years must be a whole number")
        .min(0, "Experience years cannot be negative")
        .max(70, "Invalid experience years")
        .optional(),

    bio: z
        .string()
        .max(1000, "Bio cannot exceed 1000 characters")
        .optional(),

    consultationFee: z
        .number()
        .min(0, "Consultation fee cannot be negative")
        .optional(),

    contactNumber: z
        .string()
        .regex(
            /^(?:\+8801|01)[3-9]\d{8}$/,
            "Invalid Bangladeshi phone number"
        )
        .optional(),
});

export const DoctorValidation = {
    updateDoctorSchema,
}; 