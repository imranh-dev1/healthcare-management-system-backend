import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { ScheduleServices } from "./schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const user = req.user!

    const result = await ScheduleServices.createSchedule(payload, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedule created successfully.",
        data: result,
    })

});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;
    const user = req.user!

    const result = await ScheduleServices.getMySchedules(query, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedules retrieved successfully.",
        data: result,
    })
});

export const ScheduleController = {
    createSchedule
}