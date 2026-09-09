import status from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreateSchedule, IUpdateSchedule } from "./schedule.interface";
import { prisma } from "../../lib/prisma";
import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { IQuery } from "../../interface";
import { ScheduleWhereInput } from "../../../generated/prisma/models";
import { ScheduleStatus } from "../../../generated/prisma/enums";

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

const getAllSchedules = async (query: IQuery) => {

    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"


    let limit = 10;

    if (query.limit) {
        limit = Number(query.limit);
    }

    let page = 1;

    if (query.page) {
        page = Number(query.page);
    }

    const skip = (page - 1) * limit;

    const andConditions: ScheduleWhereInput[] = [];

    if (query.doctorId) {
        andConditions.push({
            doctorId: query.doctorId
        })
    }

    if (query.email) {
        andConditions.push({
            doctor: {
                email: query.email
            }
        })
    }

    if (query.status) {
        andConditions.push({
            status: query.status
        })
    }

    if (query.searchTerm) {
        andConditions.push({
            doctor: {
                OR: [
                    { name: { contains: query.searchTerm, mode: "insensitive" } },
                    { email: { contains: query.searchTerm, mode: "insensitive" } },
                    {
                        specialization: { contains: query.searchTerm, mode: "insensitive", },
                    },

                ],
            }
        });
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

const getScheduleById = async (scheduleId: string) => {
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId
        },
        include: {
            doctor: true,
            appointments: true
        }
    });

    if (!schedule || schedule.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Schedule not found...!")
    }

    return schedule;
}

const updateSchedule = async (scheduleId: string, payload: IUpdateSchedule, user: RequestUser) => {

    const doctor = await prisma.doctor.findUnique({
        where: {
            id: user.userId,
        }
    });

    if (!doctor) {
        throw new AppError(status.NOT_FOUND, "Doctor not found.");
    }

    const existingSchedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId,
            doctorId: doctor.id
        }
    });

    if (!existingSchedule || existingSchedule.isDeleted) {
        throw new AppError(status.NOT_FOUND, "Schedule not found.");
    }

    if (existingSchedule.status === ScheduleStatus.PUBLISHED && existingSchedule.totalSlots !== existingSchedule.availableSlots) {
        throw new AppError(status.CONFLICT, "Cannot modify a published schedule that already has active bookings.")
    }

    payload.startDateTime = payload.startDateTime || existingSchedule.startDateTime
    payload.endDateTime = payload.endDateTime || existingSchedule.endDateTime
    payload.meetingLink = payload.meetingLink || existingSchedule.meetingLink

    const startOfTheDay = startOfDay(payload.startDateTime);
    const nextDay = addDays(startOfTheDay, 1);

    const schedule = await prisma.schedule.findFirst({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startOfTheDay,
                lt: nextDay
            }
        }
    });

    if (schedule) {
        throw new AppError(status.CONFLICT, "Schedule already exists for the given date.");
    }

    const durationInMinutes = differenceInMinutes(payload.startDateTime, payload.endDateTime);

    const MINUTES_ALLOCATED_PER_SLOT = 20;

    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

    const updatedSchedule = await prisma.schedule.update({
        where: {
            id: existingSchedule.id
        },
        data: {
            doctorId: doctor.id,
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots: totalSlots,
            availableSlots: totalSlots,
        },
        include: {
            doctor: true,
            appointments: true
        }
    });

    return updatedSchedule;
}



export const ScheduleServices = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById,
    updateSchedule
}
