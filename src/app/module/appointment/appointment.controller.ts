import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const user = req.user!;
    const result = await AppointmentServices.bookAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User Book appointment & payment created successfully....",
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