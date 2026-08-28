import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { DoctorServices } from "./doctor.service";

const applyingAsDoctor = catchAsync(async (req: Request, res: Response) => {

    const payload = await JSON.parse(req.body.data);

    const uploadedFiles = req.files;

    const resumeFile = Array.isArray(uploadedFiles)
        ? undefined
        : uploadedFiles?.resume?.[0];

    const additionalFiles = Array.isArray(uploadedFiles)
        ? []
        : uploadedFiles?.additionalFiles ?? [];

    const result = await DoctorServices.applyingAsDoctor(
        payload,
        resumeFile!,
        additionalFiles
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor application submitted successfully.",
        data: result,
    })

});

export const DoctorController = {
    applyingAsDoctor
}