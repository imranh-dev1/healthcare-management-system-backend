import httpStatus from "http-status";
import { AppointmentStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBikashGrantIdToken } from "../../lib/bikash"
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { IBookAppoinmentPayload, ICancleAppoinmentPayload, IPayAppoinmentPayload, IUpdateAppoinmentStatusPayload } from "./appointment.interface";
import { addMinutes, isBefore, isSameDay, subHours } from "date-fns";
import sendEmail from "../../utils/sendEmail";
import PDFDocument from "pdfkit"

const bookAppointment = async (payload: IBookAppoinmentPayload, user: RequestUser) => {

    const bikashIdToken = await getBikashGrantIdToken();

    const patient = await prisma.patient.findUnique({
        where: {
            id: user.userId
        }
    })

    if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Pataint Not Found")
    }

    const schedule = await prisma.schedule.findUnique({
        where: {
            id: payload.scheduleId
        },
        include: {
            doctor: true
        }
    })

    if (!schedule || schedule.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Schedule not found")
    }

    if (schedule.status !== ScheduleStatus.PUBLISHED) {
        throw new AppError(httpStatus.BAD_REQUEST, "This Schedule is not pubished Yet")
    }

    const now = new Date()

    if (isSameDay(now, schedule.startDateTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, "This Schedule is not Available Today")
    }

    if (!isBefore(now, schedule.startDateTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, "This Schedule Has already Started")
    }

    const existingAppoinment = await prisma.appointment.findFirst({
        where: {
            patientId: patient.id,
            scheduleId: schedule.id,
            // status: {
            //     not: AppointmentStatus.CANCELLED
            // }
        },

    })

    if (existingAppoinment?.status === AppointmentStatus.PENDING) {
        throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Pending Appoinment. Please Pay for That")
    }

    if (existingAppoinment?.status === AppointmentStatus.CONFIRMED) {
        throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Confirmed Appoinment.")
    }

    if (existingAppoinment?.status === AppointmentStatus.ONGOING) {
        throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Ongoing Appoinment.")
    }

    if (existingAppoinment?.status === AppointmentStatus.COMPLETED) {
        throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Completed Appoinment on this Schedule, Please Try Again Another day")
    }

    if (schedule.availableSlots === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, "This Schedule Is Fully Booked")
    }

    if (!schedule.doctor.consultationFee) {
        throw new AppError(httpStatus.BAD_REQUEST, "Doctor Has Not Set A Consultation Fee Yet")
    }

    const amount = schedule.doctor.consultationFee.toString();

    const bookAppointmentTransitionResult = await prisma.$transaction(async (tx) => {

        const appointment = await tx.appointment.create({
            data: {
                status: AppointmentStatus.PENDING,
                patientId: patient.id,
                doctorId: schedule.doctor.id,
                scheduleId: schedule.id,
            },
        });

        const createPaymentResponse = await fetch(`${config.bikash_sendbox_url}/tokenized/checkout/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bikashIdToken,
                "X-App-Key": config.bikash_app_key,
            },
            body: JSON.stringify({
                mode: "0011",
                payerReference: user.email,
                callbackURL: `${config.bikash_callback_url}/appointment/book-appointment/payment/callback`,
                merchantAssociationInfo: "MI05MID54RF09123456One",
                amount: amount,
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: appointment.id
            })
        })

        const createPaymentResult = await createPaymentResponse.json()

        // payment model 

        await tx.payment.create({
            data: {
                amount: amount,
                merchentInvoiceNumber: createPaymentResult.merchantInvoiceNumber,
                appointmentId: appointment.id,
                getewayResponse: createPaymentResult,
                bkashPaymentId: createPaymentResult.paymentID,
                payerReferemce: user.email,
            }
        })

        return {
            paymentUrl: createPaymentResult.bkashURL
        };
    })

    return bookAppointmentTransitionResult;

}

const payAppointment = async (payload: IPayAppoinmentPayload, user: RequestUser) => {
    const appointmentId = payload.appointmentId;
    const bikashIdToken = await getBikashGrantIdToken();

    const existingAppointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId
        },
        include: {
            schedule: {
                include: {
                    doctor: true
                }
            }
        }
    });

    if (!existingAppointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exists..!");
    }

    if (existingAppointment.status !== "PENDING") {
        throw new AppError(httpStatus.BAD_REQUEST, "Appointment Is Not Pending!");
    }

    if (!existingAppointment.schedule.doctor.consultationFee) {
        throw new AppError(httpStatus.BAD_REQUEST, "Doctor Has Not set A Consultation Fee Yet");
    }

    const amount = existingAppointment.schedule.doctor.consultationFee.toString();

    const createPaymentResponse = await fetch(`${config.bikash_sendbox_url}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bikashIdToken,
            "X-App-Key": config.bikash_app_key,
        },
        body: JSON.stringify({
            mode: "0011",
            payerReference: user.email,
            callbackURL: `${config.bikash_callback_url}/appointment/book-appointment/payment/callback`,
            merchantAssociationInfo: "MI05MID54RF09123456One",
            amount: amount,
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: existingAppointment.id
        })
    })

    const createPaymentResult = await createPaymentResponse.json()

    await prisma.payment.update({
        where: {
            appointmentId: existingAppointment.id,
        },
        data: {
            merchentInvoiceNumber: createPaymentResult.merchantInvoiceNumber,
            getewayResponse: createPaymentResult,
            bkashPaymentId: createPaymentResult.paymentID,
        }
    })

    return {
        paymentUrl: createPaymentResult.bkashURL
    }

}

const bookAppointmentCallback = async (query: Record<string, any>) => {
    const bookAppointmentCallbackTransitionResult = await prisma.$transaction(async (tx) => {

        const { paymentID, status } = query;

        if (!paymentID) {
            throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is required");
        }

        if (!status) {
            throw new AppError(httpStatus.BAD_REQUEST, "Payment Status is Missing");
        }

        const bikashIdToken = await getBikashGrantIdToken();

        if (!bikashIdToken) {
            throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
        }

        const executePaymentResponse = await fetch(`${config.bikash_sendbox_url}/tokenized/checkout/execute`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: bikashIdToken,
                    "X-App-Key": config.bikash_app_key,
                },
                body: JSON.stringify({
                    paymentID,
                }),
            }
        );

        const executePaymentResult = await executePaymentResponse.json();

        if (status === "success") {

            const appointment = await prisma.appointment.findUnique({
                where: {
                    id: executePaymentResult.merchantInvoiceNumber
                },
                include: {
                    schedule: true,
                    patient: true,
                    doctor: true
                }
            })

            if (!appointment) {
                throw new AppError(httpStatus.NOT_FOUND, "appointment Not Found...!")
            }

            const newAvailableSlots = appointment.schedule.availableSlots - 1;

            const alreadyBookedSlots = appointment.schedule.totalSlots - appointment.schedule.availableSlots;

            const serialNumber = alreadyBookedSlots + 1;

            const joiningTime = addMinutes(appointment.schedule.startDateTime, (serialNumber - 1) * 20)

            await tx.appointment.update({
                where: {
                    id: executePaymentResult.merchantInvoiceNumber
                },
                data: {
                    status: AppointmentStatus.CONFIRMED,
                    joiningTime: joiningTime,
                    serialNumber: serialNumber
                }
            })

            await prisma.schedule.update({
                where: {
                    id: appointment.schedule.id
                },
                data: {
                    availableSlots: newAvailableSlots
                }
            })

            await tx.payment.update({
                where: {
                    appointmentId: executePaymentResult.executePaymentResult,
                    bkashPaymentId: paymentID
                },
                data: {
                    status: PaymentStatus.PAID,
                    bkashTrxId: executePaymentResult.trxID,
                    paidAt: executePaymentResult.paymentExecuteTime,
                    getewayResponse: executePaymentResult
                }

            });

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

            pdfDocument.moveDown();

            pdfDocument.fontSize(14).text("Appointment Invoice", {
                align: "center",
            });

            pdfDocument.moveDown(2);

            pdfDocument.fontSize(12).text(`Patient Name: ${appointment.patient.name}`);
            pdfDocument.fontSize(12).text(`Patient Email: ${appointment.patient.email}`);

            pdfDocument.moveDown();

            pdfDocument.fontSize(12).text(`Doctor Name: ${appointment.doctor.name}`);
            pdfDocument.fontSize(12).text(`Doctor Email: ${appointment.doctor.specialization}`);

            pdfDocument.moveDown();

            pdfDocument.fontSize(12).text(`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`);

            pdfDocument.fontSize(12).text(`Your Joinig Time: ${joiningTime.toString()}`);

            pdfDocument.fontSize(12).text(`Your Serial Number: ${serialNumber}`);

            pdfDocument.fontSize(12).text(`Your Meeting Link: ${appointment.schedule.meetingLink}`);

            pdfDocument.moveDown();

            pdfDocument.fontSize(14).text(`Amount Paid: ${executePaymentResult.amount} BDT`);
            pdfDocument.fontSize(14).text(`Payment Method: Bikash`);
            pdfDocument.fontSize(14).text(`Transaction Id: ${executePaymentResult.trxID}`);
            pdfDocument.fontSize(14).text(`Paid At: ${executePaymentResult.paymentExicuteTime}`);

            pdfDocument.end();

            const pdfBuffer = await pdfReadyPromise;

            await sendEmail({
                to: appointment.patient.email,
                subject: "Your Appointment is Confirmed! - PH Healthcare",
                template: "appointment-confirmation",
                attachments: [
                    {
                        fileName: "invoice.pdf",
                        content: pdfBuffer
                    }
                ]
            });

            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=success`
            }
        } else if (status === "failure") {

            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentID
                },
                data: {
                    status: PaymentStatus.FAILED,
                    getewayResponse: executePaymentResult
                }

            })

            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failure`
            }
        } else if (status === "cancel") {
            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentID
                },
                data: {
                    status: PaymentStatus.CANCELLED,
                    getewayResponse: executePaymentResult
                }

            })

            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failure`
            }
        } else {
            return {
                executePaymentResult,
                redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failed`
            };
        }

    })

    return bookAppointmentCallbackTransitionResult
};

const cancleAppointment = async (payload: ICancleAppoinmentPayload, user: RequestUser) => {

    const transactionResult = await prisma.$transaction(async (tx) => {
        const appointmentId = payload.appointmentId;

        const existingAppointment = await prisma.appointment.findUnique({
            where: {
                id: appointmentId,
                patient: {
                    email: user.email
                }
            },
            include: {
                payment: true,
                schedule: true
            }

        });

        if (!existingAppointment) {
            throw new AppError(404, "Appointment Does Not Exists..!");
        }

        if (existingAppointment.status === "ONGOING" || existingAppointment.status === "COMPLETED") {
            throw new AppError(400, "Appointment Ongoing or Completed, Not this Appointment Refund");
        }

        if (existingAppointment.status === "CANCELLED") {
            throw new AppError(400, "Appointment Already Cancelled");
        }

        const updatedAppointment = await tx.appointment.update({
            where: {
                id: existingAppointment.id
            },
            data: {
                status: AppointmentStatus.CANCELLED,
            }
        })

        await prisma.schedule.update({
            where: {
                id: existingAppointment.schedule.id,
            },
            data: {
                availableSlots: {
                    increment: 1
                }
            }
        })

        // refund Process 
        const now = new Date();

        const startDateTime = existingAppointment.schedule.startDateTime;
        const refundCutOfTime = subHours(startDateTime, 1);

        const isEligbleForRefund = isBefore(now, refundCutOfTime);

        if (isEligbleForRefund) {
            const bikashIdToken = await getBikashGrantIdToken();

            if (!bikashIdToken) {
                throw new AppError(502, "No Bkash Access Token Found!");
            }

            const refundPaymentResponse = await fetch(`${config.bikash_sendbox_url}/tokenized/checkout/payment/refund`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: bikashIdToken,
                    "X-App-Key": config.bikash_app_key,
                },
                body: JSON.stringify({
                    paymentID: existingAppointment.payment?.bkashPaymentId,
                    trxID: existingAppointment.payment?.bkashTrxId,
                    amount: existingAppointment.payment?.amount.toString(),
                    sku: "Appointment Canceletion",
                    reason: "Patient Cancelled The Appointment"

                })
            })

            const refundPaymentResult = await refundPaymentResponse.json();

            const updatePayment = await tx.payment.update({
                where: {
                    appointmentId: existingAppointment.id,
                },
                data: {
                    refundTrxId: refundPaymentResult.refundTrxID,
                    refundedAt: refundPaymentResult.completedTime,
                    refundAmount: refundPaymentResult.amount,
                    refundReason: "Patient Cancelled The Appointment",
                    status: PaymentStatus.REFUNDED,
                    getewayResponse: refundPaymentResult,
                }
            })

            console.log("refund", { refundPaymentResult }, "UpdatePayment", updatePayment)
        }

        const newPaymentInfo = await prisma.payment.findUnique({
            where: {
                appointmentId: existingAppointment.id,
            }
        })

        return {
            appointment: updatedAppointment,
            payment: newPaymentInfo
        }
    });

    return transactionResult;

}

// doctor onliy
const updateAppoinmentStatus = async (appoinmentId: string, payload: IUpdateAppoinmentStatusPayload, user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            id: user.userId
        }
    })

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found..!")
    }

    const appoinment = await prisma.appointment.findUnique({
        where: {
            id: appoinmentId,
            doctorId: doctor.id
        }
    })

    if (!appoinment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appoinment Not Found..!")
    }

    if (appoinment.status === AppointmentStatus.COMPLETED) {
        throw new AppError(httpStatus.FORBIDDEN, "Appoinment is Already Completed")
    }

    if (appoinment.status === AppointmentStatus.CANCELLED) {
        throw new AppError(httpStatus.FORBIDDEN, "Appoinment is Already Canceled")
    }

    if (appoinment.status === AppointmentStatus.PENDING) {
        throw new AppError(httpStatus.FORBIDDEN, "Appoinment is Already Pending. You Can Change the status after appoinment is confirmed")
    }

    if (appoinment.status === AppointmentStatus.CONFIRMED) {
        if (payload.status !== "ONGOING") {
            throw new AppError(httpStatus.BAD_REQUEST, "Confirmed Appoinment Must Be Ongoing At First")
        }

        await prisma.appointment.update({
            where: {
                id: appoinment.id
            },
            data: {
                status: AppointmentStatus.ONGOING
            }
        })
    }

    if (appoinment.status === AppointmentStatus.ONGOING) {
        if (payload.status !== "COMPLETED") {
            throw new AppError(httpStatus.BAD_REQUEST, "Ongoing Appoinment Must Be Ongoing At Completed")
        }

        await prisma.appointment.update({
            where: {
                id: appoinment.id
            },
            data: {
                status: AppointmentStatus.COMPLETED
            }
        })
    }

    const updatedAppointment = await prisma.appointment.findUnique({
        where: {
            id: appoinment.id
        }
    })

    return updatedAppointment;

}

export const AppointmentServices = {
    bookAppointment,
    payAppointment,
    bookAppointmentCallback,
    cancleAppointment,
    updateAppoinmentStatus
}