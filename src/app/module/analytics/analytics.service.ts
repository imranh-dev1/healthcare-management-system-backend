import { AppointmentStatus, DoctorVerificationStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError"
import httpStatus from "http-status"

const getAdminAnalytics = async () => {
    const totalDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false
        }
    })
    const totalPendingDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.PENDING
        }
    })
    const totalApprovedDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.APPROVED
        }
    })
    const totalRejectDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.REJECT
        }
    })

    const totalPatients = await prisma.patient.count({
        where: {
            isDeleted: false
        }
    })

    const totalAppointments = await prisma.appointment.count()

    const completedAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.COMPLETED
        }
    })

    const cancelldAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.CANCELLED
        }
    })

    const ongoingAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.ONGOING
        }
    })

    const pendingAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.PENDING
        }
    })

    const confirmedAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.CONFIRMED
        }
    })

    const totalRefundResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    })

    const totalRefund = totalRefundResult._sum.amount?.toNumber() || 0

    const totalRevenueResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalRevenue = (totalRevenueResult._sum.amount?.toNumber() || 0) - (totalRefund)

    return {
        totalDoctors,
        totalPendingDoctorApplications,
        totalApprovedDoctorApplications,
        totalRejectDoctorApplications,
        totalPatients,
        totalAppointments,
        completedAppointments,
        cancelldAppointments,
        ongoingAppointments,
        pendingAppointments,
        confirmedAppointments,
        totalRevenue,
        totalRefund
    }

}
const getPatientAnalytics = async (user: RequestUser) => {
    const patient = await prisma.patient.findUnique({
        where: {
            id: user.userId
        }
    })

    if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient Not Found...")
    }

    const totalAppointments = await prisma.appointment.count({
        where: {
            patientId: user.userId
        }
    })

    const upcomingAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CONFIRMED
        }
    })

    const completedAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.COMPLETED
        }
    })

    const cancelledAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CANCELLED
        }
    })

    const totalSpentResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id
            },
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalAmountSpent = totalSpentResult._sum.amount?.toNumber() || 0;

    const totalRefundResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id
            },
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    })

    const totalRefundAmount = totalRefundResult._sum.amount?.toNumber() || 0;

    return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalSpentResult,
        totalAmountSpent,
        totalRefundAmount
    }

}
const getDotorAnalytics = async (user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient Not Found...")
    }

    const totalSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false
        }
    })

    const publishedSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.PUBLISHED
        }
    })
    const draftSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.DRAFT
        }
    })

    const totalAppointments = await prisma.appointment.count({
        where: {
            doctorId: user.userId
        }
    })

    const upcomingAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.CONFIRMED
        }
    })

    const completedAppointments = await prisma.appointment.count({
        where: {
            patientId: doctor.id,
            status: AppointmentStatus.COMPLETED
        }
    })

    const cancelledAppointments = await prisma.appointment.count({
        where: {
            patientId: doctor.id,
            status: AppointmentStatus.CANCELLED
        }
    })

    const totalDoctorRefundResult = await prisma.payment.aggregate({
        where: {
            id: doctor.id,
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalDoctorRefund = totalDoctorRefundResult._sum.amount?.toNumber() || 0;

    const totalDoctorErnigsResult = await prisma.payment.aggregate({
        where: {
            id: doctor.id,
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalDoctorErnigs = (totalDoctorErnigsResult._sum.amount?.toNumber() || 0) - totalDoctorRefund;

    return {
        totalSchedules,
        publishedSchedules,
        draftSchedules,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalDoctorRefund,
        totalDoctorErnigs
    }

}

export const AnalyticsServices = {
    getAdminAnalytics,
    getDotorAnalytics,
    getPatientAnalytics
}