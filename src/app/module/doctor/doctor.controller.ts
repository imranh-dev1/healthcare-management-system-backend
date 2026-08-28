import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { DoctorServices } from "./doctor.service";
import { ApplyingAsDoctorValidationSchema } from "./doctor.validation";

const applyingAsDoctor = catchAsync(async (req: Request, res: Response) => {

    const uploadedFiles = req.files;

    const resumeFile = Array.isArray(uploadedFiles)
        ? undefined
        : uploadedFiles?.resume?.[0];

    const additionalFiles = Array.isArray(uploadedFiles)
        ? []
        : uploadedFiles?.additionalFiles ?? [];

    const zodValidationResult = ApplyingAsDoctorValidationSchema.safeParse(
        JSON.parse(req.body.data),
    );

    if (!zodValidationResult.success) {
        throw new Error(zodValidationResult.error.issues[0].message);
    }

    const payload = zodValidationResult.data;

    const result = await DoctorServices.applyingAsDoctor(
        payload,
        resumeFile!,
        additionalFiles
    );



    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor application submitted successfully. Please check your email to verify your account.",
        data: result,
    })

});

const verifiDoctorEmail = catchAsync(async (req: Request, res: Response) => {

    const payload = req.body;

    const result = await DoctorServices.verifiDoctorEmail(payload);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor Email Verified Successfully",
        data: result,
    })

});


const approvedDoctor = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;

    const result = await DoctorServices.approvedDoctor(payload);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor application approved successfully.",
        data: result,
    });
});

export const DoctorController = {
    applyingAsDoctor,
    verifiDoctorEmail,
    approvedDoctor
}