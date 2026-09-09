import status from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreateSchedule } from "./schedule.interface";
import { prisma } from "../../lib/prisma";
import { addDays, differenceInMinutes, startOfDay } from "date-fns";

const createSchedule = async (payload: ICreateSchedule, user: RequestUser) => {
    const existingDoctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!existingDoctor) {
        throw new AppError(status.NOT_FOUND, "Doctor not found.");
    }

    const startOfTheDay = startOfDay(payload.startDateTime);
    const nextDay = addDays(startOfTheDay, 1);

    const existingSchedule = await prisma.schedule.findFirst({
        where: {
            doctorId: existingDoctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startOfTheDay,
                lt: nextDay
            }
        }
    });

    if (existingSchedule) {
        throw new AppError(status.CONFLICT, "Schedule already exists for the given date.");
    }

    const durationInMinutes = differenceInMinutes(payload.startDateTime, payload.endDateTime);

    const MINUTES_ALLOCATED_PER_SLOT = 20;

    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

    const newSchedule = await prisma.schedule.create({
        data: {
            doctorId: existingDoctor.id,
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots: totalSlots,
            availableSlots: totalSlots,
        },
        include: {
            doctor: true
        }
    });

    return newSchedule;
}

export const ScheduleServices = {
    createSchedule
}
