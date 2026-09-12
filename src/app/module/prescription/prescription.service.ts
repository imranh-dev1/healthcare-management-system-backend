import { UploadApiResponse } from "cloudinary"
import { AppointmentStatus, Role } from "../../../generated/prisma/enums"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/AppError"
import { ICreatePrescriptionPayload } from "./prescription.interface"
import httpStatus from "http-status"
import PDFDocument from "pdfkit"
import { cloudinary } from "../../lib/cloudinary"
import sendEmail from "../../utils/sendEmail"

const createPrescription = async (payload: ICreatePrescriptionPayload, user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found..!")
    }

    const appointment = await prisma.appointment.findUnique({
        where: {
            id: payload.appointmentId,
            doctorId: doctor.id
        },
        include: {
            patient: true,
            schedule: true
        }
    })

    if (!appointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found..!")
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
        throw new AppError(httpStatus.CONFLICT, "Prescription Can onliy Be Written for a completed Appointment")
    }

    if (appointment.prescriptionUrl) {
        throw new AppError(httpStatus.CONFLICT, "A Prescription Already Exists For This")
    }

    const pdfDocument = new PDFDocument({
        size: "A4",
        margin: 50,
    });

    const pdfChuncks: Buffer[] = []

    pdfDocument.on("data", (chunck: Buffer) => {
        pdfChuncks.push(chunck)
    })

    const pdfReadyPromise = new Promise<Buffer>((resolve) => {
        pdfDocument.on("end", () => {
            resolve(Buffer.concat(pdfChuncks))
        })
    })

    pdfDocument.fontSize(22).text("Healthcare Management System", {
        align: "center",
    });

    pdfDocument.fontSize(14).text("Prescription", {
        align: "center",
    });

    pdfDocument.moveDown(2);

    pdfDocument.fontSize(12).text(`Pataint Name: ${appointment.patient.name}`);
    pdfDocument.fontSize(12).text(`Doctor Name: ${doctor.name}`);
    pdfDocument.fontSize(12).text(`Specialization: ${doctor.specialization}`);
    pdfDocument.fontSize(12).text(`Date: ${new Date().toDateString()}`);

    pdfDocument.moveDown();

    pdfDocument.fontSize(12).text(`Findings`);
    pdfDocument.fontSize(12).text(payload.finding);

    pdfDocument.moveDown();

    pdfDocument.fontSize(12).text(`Medicines`);
    pdfDocument.moveDown(0.5);

    for (let i = 0; i < payload.medicines.length; i++) {
        const medicine = payload.medicines[i];

        pdfDocument.fontSize(12).text(`${i + 1}. ${medicine.name}`);
        pdfDocument.fontSize(12).text(`Dosage: ${medicine.dosage}`);
        pdfDocument.fontSize(12).text(`Duration: ${medicine.duration}`);

        if (medicine.instructions) {
            pdfDocument.fontSize(12).text(`Instructions: ${medicine.instructions}`);

        }
        pdfDocument.moveDown(0.5);
    }

    pdfDocument.end();

    const pdfBuffer = await pdfReadyPromise;

    const prescriptionUploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: "raw", format: "pdf" },
            async (error, result) => {
                if (error) {
                    return reject(error)
                }

                if (!result) {
                    return reject(new AppError(502, "No Result form Cloudanry"))
                }

                resolve(result)
            }
        ).end(pdfBuffer)
    })

    const updateAppointment = await prisma.appointment.update({
        where: {
            id: appointment.id
        },
        data: {
            prescriptionUrl: prescriptionUploadResult.secure_url,
            prescriptionPublicId: prescriptionUploadResult.public_id
        }
    })

    await sendEmail({
        to: appointment.patient.email,
        subject: "Your Prescription - PH Healthcare System",
        template: "prescription",
        data: {
            patientName: appointment.patient.name,
            doctorName: doctor.name,
            appointmentDate: appointment.schedule.startDateTime,
            appointmentId: appointment.id,
        },
        attachments: [
            {
                fileName: "prescription.pdf",
                content: pdfBuffer,
            },
        ],
    });

    return updateAppointment
}

const getSinglePrescription = async (appointmentId: string, user: RequestUser) => {
    const appointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId
        },
        include: {
            patient: true,
            schedule: true,
            doctor: true
        }
    })

    if (!appointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found..!")
    }

    if (user.role === Role.PATIENT) {
        if (appointment.patient.userId !== user.userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are Allowed to view this Appointment")
        }
    }
    if (user.role === Role.DOCTOR) {
        if (appointment.doctor.userId !== user.userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are Allowed to view this Appointment")
        }
    }

    if (!appointment.prescriptionUrl) {
        throw new AppError(httpStatus.NOT_FOUND, "No Prescription Has Been Written Yet")
    }

    return {
        appointment,
        prescription: appointment.prescriptionUrl
    }

}

export const PrescriptionServices = {
    createPrescription,
    getSinglePrescription
}