import { AppointmentStatus, DoctorVerificationStatus, ScheduleStatus } from "../../../generated/prisma/enums"
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
        confirmedAppointments

    }

}
const getDotorAnalytics = async (user: RequestUser) => {
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

    return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments
    }

}
const getPatientAnalytics = async (user: RequestUser) => {
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
    return {
        totalSchedules,
        publishedSchedules,
        draftSchedules,
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments
    }

}

export const AnalyticsServices = {
    getAdminAnalytics,
    getDotorAnalytics,
    getPatientAnalytics
}