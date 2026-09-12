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
        message: "User Book appointment created successfully....",
        data: result,
    });
});


const payAppointment = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const user = req.user!;
    const result = await AppointmentServices.payAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Book appointment payment successfully....",
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

const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const user = req.user!
    const result = await AppointmentServices.cancleAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Book appointment Canceld successfully....",
        data: result,
    });
});

const updateAppointmentStatus = catchAsync(async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    const user = req.user!
    const payload = req.body;

    const result = await AppointmentServices.updateAppoinmentStatus(appointmentId as string, payload, user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment status updated successfully",
        data: result,
    });
});

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!
    const query = req.query;

    const { data, meta } = await AppointmentServices.getMyAppointments(query, user);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "My appointments retrieved successfully",
        data: {
            data,
            meta
        },
    });
});

const getDoctorAppointments = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!
    const query = req.query;
    const { data, meta } = await AppointmentServices.getDoctorAppointments(query, user);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "Doctor appointments retrieved successfully",
        data: {
            data,
            meta
        },
    });
});

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await AppointmentServices.getAllAppointments(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "All appointments retrieved successfully",
        data: {
            data,
            meta
        },
    });
});

const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!
    const { appointmentId } = req.params;

    const result = await AppointmentServices.getSingleAppointment(appointmentId as string, user);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "Appointment retrieved successfully",
        data: result,
    });
});

export const AppointmentController = {
    bookAppointment,
    payAppointment,
    bookAppointmentCallback,
    cancelAppointment,
    updateAppointmentStatus,
    getMyAppointments,
    getDoctorAppointments,
    getAllAppointments,
    getSingleAppointment
}