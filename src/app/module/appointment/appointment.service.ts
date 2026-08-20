import config from "../../config";
import { getBikashGrantIdToken } from "../../lib/bikash"

const bookAppointment = async () => {

    const bikashIdToken = await getBikashGrantIdToken();

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
            payerReference: "01723888888",
            callbackURL: `${config.bikash_callback_url}/appointment/book-appointment/payment/callback`,
            merchantAssociationInfo: "MI05MID54RF09123456One",
            amount: "500",
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: "Inv0124"
        })
    })

    const createPaymentResult = await createPaymentResponse.json()

    console.log(createPaymentResult)

    return createPaymentResult
}

const bookAppointmentCallback = async (query: Record<string, any>) => {

    console.log("bKash Callback Query:", query);

    const { paymentID, status } = query;

    if (!paymentID) {
        throw new Error("Payment ID is required");
    }

    const bikashIdToken = await getBikashGrantIdToken();

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
        return {
            executePaymentResult,
            redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=success`
        }
    }

    if (status === "failure") {
        return {
            executePaymentResult,
            redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failure`
        }
    }

    return {
        executePaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appoinment?status=cancelled`
    };
};

export const AppointmentServices = {
    bookAppointment,
    bookAppointmentCallback
}