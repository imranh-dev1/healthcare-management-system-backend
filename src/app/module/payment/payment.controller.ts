import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { PaymentServices } from "./payment.service";

const getMyPayment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!
    const query = req.query;

    const {data, meta} = await PaymentServices.getMyPayments(query, user);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "Payments Data retrieved successfully",
        data: {
            data,
            meta
        },
    });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const {data, meta} = await PaymentServices.getAllPayments(query);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "Payments Data retrieved successfully",
        data: {
            data,
            meta
        },
    });
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const result = await PaymentServices.getAllPayments(query);
    sendResponse(res, {
        statusCode: httpStatus.OK, success: true,
        message: "Payments Data retrieved successfully",
        data: result,
    });
});

export const PaymentController = {
    getMyPayment,
    getAllPayments,
    getSinglePayment
}