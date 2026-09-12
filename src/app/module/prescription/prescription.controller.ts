import { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PrescriptionServices } from "./prescription.service";


// Create Prescription
const createPrescription = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user!;
        const result = await PrescriptionServices.createPrescription(
            req.body,
            user
        );

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: "Prescription created successfully",
            data: result,
        });
    }
);


// Get Single Prescription
const getSinglePrescription = catchAsync(
    async (req: Request, res: Response) => {
        const { appointmentId } = req.params;
        const user = req.user!;

        const result = await PrescriptionServices.getSinglePrescription(
            appointmentId as string,
            user
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Prescription retrieved successfully",
            data: result,
        });
    }
);


export const PrescriptionController = {
    createPrescription,
    getSinglePrescription,
}; 