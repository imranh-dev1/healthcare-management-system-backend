import { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsServices } from "./analytics.service";


// Admin Analytics
const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await AnalyticsServices.getAdminAnalytics();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin analytics retrieved successfully",
        data: result,
    });
}
);


// Doctor Analytics
const getDotorAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getDotorAnalytics(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor analytics retrieved successfully",
        data: result,
    });
}
);


// Patient Analytics
const getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getPatientAnalytics(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Patient analytics retrieved successfully",
        data: result,
    });
}
);


export const AnalyticsController = {
    getAdminAnalytics,
    getDotorAnalytics,
    getPatientAnalytics,
}; 
