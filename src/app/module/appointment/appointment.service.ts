import status from "http-status";
import { AppointmentStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBikashGrantIdToken } from "../../lib/bikash"
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { IBookAppoinmentPayload } from "./appointment.interface";
import { isBefore, isSameDay } from "date-fns";

const bookAppointment = async (payload: IBookAppoinmentPayload, user: RequestUser) => {

    const bikashIdToken = await getBikashGrantIdToken();

    const patient = await prisma.patient.findUnique({
        where: {
            id: user.userId
        }
    })

    if (!patient) {
        throw new AppError(status.NOT_FOUND, "Pataint Not Found")
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
        throw new AppError(status.NOT_FOUND, "Schedule not found")
    }

    if (schedule.status !== ScheduleStatus.PUBLISHED) {
        throw new AppError(status.BAD_REQUEST, "This Schedule is not pubished Yet")
    }

    const now = new Date()

    if (isSameDay(now, schedule.startDateTime)) {
        throw new AppError(status.BAD_REQUEST, "This Schedule is not Available Today")
    }

    if (!isBefore(now, schedule.startDateTime)) {
        throw new AppError(status.BAD_REQUEST, "This Schedule Has already Started")
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
        throw new AppError(status.BAD_REQUEST, "You Already Have A Pending Appoinment. Please Pay for That")
    }

    if (existingAppoinment?.status === AppointmentStatus.CONFIRMED) {
        throw new AppError(status.BAD_REQUEST, "You Already Have A Confirmed Appoinment.")
    }

    if (existingAppoinment?.status === AppointmentStatus.ONGOING) {
        throw new AppError(status.BAD_REQUEST, "You Already Have A Ongoing Appoinment.")
    }

    if (existingAppoinment?.status === AppointmentStatus.COMPLETED) {
        throw new AppError(status.BAD_REQUEST, "You Already Have A Completed Appoinment on this Schedule, Please Try Again Another day")
    }

    if (schedule.availableSlots === 0) {
        throw new AppError(status.BAD_REQUEST, "This Schedule Is Fully Booked")
    }

    if (!schedule.doctor.consultationFee) {
        throw new AppError(status.BAD_REQUEST, "Doctor Has Not Set A Consultation Fee Yet")
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

const payAppointment = async (payload: any, user: RequestUser) => {
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
        throw new AppError(404, "Appointment Does Not Exists..!");
    }

    if (existingAppointment.status !== "PENDING") {
        throw new AppError(400, "Appointment Is Not Pending!");
    }

    if (!existingAppointment.schedule.doctor.consultationFee) {
        throw new AppError(status.BAD_REQUEST, "Doctor Has Not set A Consultation Fee Yet");
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
            throw new AppError(400, "Payment ID is required");
        }

        if (!status) {
            throw new AppError(400, "Payment Status is Missing");
        }

        const bikashIdToken = await getBikashGrantIdToken();

        if (!bikashIdToken) {
            throw new AppError(502, "No Bkash Access Token Found!");
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

            await tx.appointment.update({
                where: {
                    id: executePaymentResult.merchantInvoiceNumber
                },
                data: {
                    status: AppointmentStatus.CONFIRMED
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

            })

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

const cancleAppointment = async (payload: any) => {

    const transactionResult = await prisma.$transaction(async (tx) => {
        const appointmentId = payload.appointmentId;

        const existingAppointment = await prisma.appointment.findUnique({
            where: {
                id: appointmentId
            },
            include: {
                payment: true
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
                status: 'CANCELLED'
            }
        })

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

        return {
            appointment: updatedAppointment,
            payment: updatePayment
        }
    });

    return transactionResult;

}

export const AppointmentServices = {
    bookAppointment,
    payAppointment,
    bookAppointmentCallback,
    cancleAppointment
}