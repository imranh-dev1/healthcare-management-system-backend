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

    // console.log(createPaymentResult)

    return createPaymentResult
}

const bookAppointmentCallback = async () => {

    return {
        success: true
    }

}

export const AppointmentServices = {
    bookAppointment,
    bookAppointmentCallback
}