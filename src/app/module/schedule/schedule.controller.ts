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

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
    const scheduleId = req.query.scheduleId as string;
    const user = req.user!;
    const payload = req.body;

    const result = await ScheduleServices.updateSchedule(scheduleId, payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedule updated successfully.",
        data: result,
    })
})

const publishSchedule = catchAsync(async (req: Request, res: Response) => {
    const scheduleId = req.query.scheduleId as string;
    const user = req.user!;

    const result = await ScheduleServices.publishSchedule(scheduleId, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedule published successfully.",
        data: result,
    })
})

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
    const scheduleId = req.query.scheduleId as string;
    const user = req.user!;

    const result = await ScheduleServices.deleteSchedule(scheduleId, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Schedule deleted successfully.",
        data: result,
    })
})

const getTodaysSchedules = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const result = await ScheduleServices.getTodaysSchedules(query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Today's schedules retrieved successfully.",
        data: result,
    });
});

export const ScheduleController = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    publishSchedule,
    deleteSchedule,
    getTodaysSchedules
}