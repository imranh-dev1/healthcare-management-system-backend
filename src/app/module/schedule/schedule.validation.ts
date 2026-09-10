import { z } from "zod";

export const createScheduleValidationSchema = z
    .object({
        startDateTime: z.string().datetime({
            message: "Invalid start date and time",
        }),

        endDateTime: z.string().datetime({
            message: "Invalid end date and time",
        }),

        totalSlots: z
            .number()
            .int()
            .positive("Total slots must be greater than 0"),

        availableSlots: z
            .number()
            .int()
            .nonnegative("Available slots cannot be negative"),

        meetingLink: z.string().url("Meeting link must be a valid URL"),
    })
    .refine(
        (data) => new Date(data.endDateTime) > new Date(data.startDateTime),
        {
            message: "End date and time must be after start date and time",
            path: ["endDateTime"],
        }
    )
    .refine(
        (data) => data.availableSlots <= data.totalSlots,
        {
            message: "Available slots cannot exceed total slots",
            path: ["availableSlots"],
        }
    );

export const updateScheduleValidationSchema = z.object({
    startDateTime: z
        .string()
        .datetime({
            message: "Invalid start date and time",
        })
        .optional(),

    endDateTime: z
        .string()
        .datetime({
            message: "Invalid end date and time",
        })
        .optional(),

    totalSlots: z
        .number()
        .int()
        .positive("Total slots must be greater than 0")
        .optional(),

    availableSlots: z
        .number()
        .int()
        .nonnegative("Available slots cannot be negative")
        .optional(),

    meetingLink: z
        .string()
        .url("Meeting link must be a valid URL")
        .optional(),
})
    .refine(
        (data) => {
            if (data.startDateTime && data.endDateTime) {
                return (
                    new Date(data.endDateTime) >
                    new Date(data.startDateTime)
                );
            }

            return true;
        },
        {
            message: "End date and time must be after start date and time",
            path: ["endDateTime"],
        }
    )
    .refine(
        (data) => {
            if (
                data.totalSlots !== undefined &&
                data.availableSlots !== undefined
            ) {
                return data.availableSlots <= data.totalSlots;
            }

            return true;
        },
        {
            message: "Available slots cannot exceed total slots",
            path: ["availableSlots"],
        }
    ); 