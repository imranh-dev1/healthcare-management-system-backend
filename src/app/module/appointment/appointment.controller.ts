import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {

    const result = await AppointmentServices.bookAppointment()

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User Book appointment successfully....",
        data: result,
    });
});
const bookAppointmentCallback = catchAsync(async (req: Request, res: Response) => {

    const { executePaymentResult, redirectUrl } = await AppointmentServices.bookAppointmentCallback(req.query)

    console.log(executePaymentResult)

    res.redirect(redirectUrl as string)

    // sendResponse(res, {
    //     statusCode: httpStatus.OK,
    //     success: true,
    //     message: "User Book appointment Callback run successfully....",
    //     data: executePaymentResult,
    // });

});

export const AppointmentController = {
    bookAppointment,
    bookAppointmentCallback
}