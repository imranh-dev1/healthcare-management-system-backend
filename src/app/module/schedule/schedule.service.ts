import status from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreateSchedule } from "./schedule.interface";
import { prisma } from "../../lib/prisma";
import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { IQuery } from "../../interface";
import { ScheduleWhereInput } from "../../../generated/prisma/models";

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

const getMySchedules = async (query: IQuery, user: RequestUser) => {

    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const existingDoctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!existingDoctor) {
        throw new AppError(status.NOT_FOUND, "Doctor not found.");
    }

    let limit = 10;

    if (query.limit) {
        limit = Number(query.limit);
    }

    let page = 1;

    if (query.page) {
        page = Number(query.page);
    }

    const skip = (page - 1) * limit;

    const andConditions: ScheduleWhereInput[] = [
        {
            doctorId: existingDoctor.id,
        },
        {
            isDeleted: false
        }
    ];

    if (query.status) {
        andConditions.push({
            status: query.status
        })
    }

    const schedules = await prisma.schedule.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip: skip,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: {
            doctor: true,
            appointments: {
                include: {
                    patient: true
                }
            },

        }
    });

    const totalSchedules = await prisma.schedule.count({
        where: {
            AND: andConditions
        },

    });

    return {
        data: schedules,
        meta: {
            page: page,
            limit: limit,
            total: Math.ceil(totalSchedules / limit)
        }
    };

}

export const ScheduleServices = {
    createSchedule,
    getMySchedules
}
