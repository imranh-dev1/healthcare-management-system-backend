import { AppointmentStatus, PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBikashGrantIdToken } from "../../lib/bikash"
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = async (payload: any, user: RequestUser) => {

    const bikashIdToken = await getBikashGrantIdToken();

    const bookAppointmentTransitionResult = await prisma.$transaction(async (tx) => {

        const appointment = await tx.appointment.create({
            data: {
                status: AppointmentStatus.PENDING,
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
                amount: "500",
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: appointment.id
            })
        })

        const createPaymentResult = await createPaymentResponse.json()

        // payment model 

        await tx.payment.create({
            data: {
                amount: "1000",
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
        }
    });

    if (!existingAppointment) {
        throw new Error("Appointment Does Not Exists..!");
    }

    if (existingAppointment.status !== "PENDING") {
        throw new Error("Appointment Is Not Pending!");
    }

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
            amount: "500",
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
            throw new Error("Payment ID is required");
        }

        if (!status) {
            throw new Error("Payment Status is Missing");
        }

        const bikashIdToken = await getBikashGrantIdToken();

        if (!bikashIdToken) {
            throw new Error("No Bkash Access Token Found!");
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
            throw new Error("Appointment Does Not Exists..!");
        }

        if (existingAppointment.status === "ONGOING" || existingAppointment.status === "COMPLETED") {
            throw new Error("Appointment Ongoing or Completed, Not this Appointment Refund");
        }

        if (existingAppointment.status === "CANCELLED") {
            throw new Error("Appointment Already Cancelled");
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
            throw new Error("No Bkash Access Token Found!");
        }

        const refundPaymentResponse = await fetch(`${config.bikash_sendbox_url}/v2/tokenized-checkout/refund/payment/transaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bikashIdToken,
                "X-App-Key": config.bikash_app_key,
            },
            body: JSON.stringify({
                paymentId: existingAppointment.payment?.bkashPaymentId,
                trxId: existingAppointment.payment?.bkashTrxId,
                refundAmount: existingAppointment.payment?.amount,
                reason: "Patient Cancelled The Appointment"

            })
        })

        const refundPaymentResult = await refundPaymentResponse.json();

        const updatePayment = await tx.payment.update({
            where: {
                appointmentId: existingAppointment.id,
            },
            data: {
                refundTrxId: refundPaymentResult.refundTrxId,
                refundAmount: refundPaymentResult.refundAmount,
                refundedAt: refundPaymentResult.completedTime,
                refundReason: "Patient Cancelled The Appointment"
            }
        })

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