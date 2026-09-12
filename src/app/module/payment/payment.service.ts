import { Role } from "../../../generated/prisma/enums"
import { PaymentWhereInput } from "../../../generated/prisma/models"
import { IQuery } from "../../interface"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError"
import httpStatus from "http-status"

const getMyPayments = async (query: IQuery, user: RequestUser) => {

    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const pataint = await prisma.patient.findUnique({
        where: {
            id: user.userId
        }
    })

    if (!pataint) {
        throw new AppError(httpStatus.NOT_FOUND, "Pataint Not Found...!")
    }

    const andConditions: PaymentWhereInput[] = [
        {
            appointment: { patientId: pataint.id }
        }
    ]

    const payments = await prisma.payment.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            appointment: {
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true
                        }
                    },
                    schedule: true
                }
            }
        }
    })

    const total = await prisma.payment.count({
        where: {
            AND: andConditions
        }
    })

    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }

}

const getAllPayments = async (query: IQuery) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const andConditions: PaymentWhereInput[] = []

    if (query.pataintEmail) {
        andConditions.push({
            appointment: {
                patient: {
                    email: query.email
                }
            }
        })
    }

    const payments = await prisma.payment.findMany({
        where: {
            AND: andConditions
        },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            appointment: {
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true
                        }
                    },
                    schedule: true
                }
            }
        }
    })

    const total = await prisma.payment.count({
        where: {
            AND: andConditions
        }
    })

    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }
}

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
    const payment = await prisma.payment.findUnique({
        where: {
            id: paymentId
        },
        include: {
            appointment: {
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true
                        }
                    },
                    schedule: true
                }
            }
        }
    })

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment Not Found ..!")
    }

    if (user.role === Role.PATIENT) {
        if (payment.appointment.patientId !== user.userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are Allowed to view this Payment")
        }
    }

    return payment;
}

export const PaymentServices = {
    getMyPayments,
    getAllPayments,
    getSinglePayment
}