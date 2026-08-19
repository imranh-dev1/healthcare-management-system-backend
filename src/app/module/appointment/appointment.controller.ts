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

export const AppointmentController = {
    bookAppointment
}