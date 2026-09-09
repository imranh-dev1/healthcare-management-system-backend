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

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const result = await ScheduleServices.getAllSchedules(query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedules retrieved successfully.",
        data: result,
    })
});

const getScheduleById = catchAsync(async (req: Request, res: Response) => {
    const scheduleId = req.params.id as string;
    const result = await ScheduleServices.getScheduleById(scheduleId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedule retrieved successfully.",
        data: result,
    });
});

export const ScheduleController = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById
}