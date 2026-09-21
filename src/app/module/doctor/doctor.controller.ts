import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { DoctorServices } from "./doctor.service";
import { ApplyingAsDoctorValidationSchema } from "./doctor.validation";
import { AppError } from "../../utils/AppError";

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
        throw new AppError(400, zodValidationResult.error.issues[0].message);
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

    const result = await DoctorServices.approvedDoctor(payload, req.user!);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor application approved successfully.",
        data: result,
    });
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await DoctorServices.getAllDoctors(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctors retrieved successfully.",
        data: data, meta,
    });
});

const getSingleDoctorAdminProfile = catchAsync(async (req: Request, res: Response) => {
    const doctorId = req.params.doctorId as string;

    const result = await DoctorServices.getSingleDoctorAdminProfile(doctorId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor profile retrieved successfully.",
        data: result,
    });
});

const updateMyDoctorProfile = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const payload = req.body;
    const result = await DoctorServices.updateMyDoctorProfile(payload, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor profile updated successfully",
        data: result,
    });
});

const getAvailableDoctorByTodaysSchedule = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await DoctorServices.getAvailableDoctorByTodaysSchedule(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Available doctors retrieved successfully.",
        data: { data, meta },
    });
});

const getAllDoctorsListPublic = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await DoctorServices.getAllDoctorsListPublic(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctors retrieved successfully.",
        data: { data, meta },
    });
});

const getSingleDoctorPublicProfile = catchAsync(async (req: Request, res: Response) => {
    const doctorId = req.params.doctorId as string;

    const result = await DoctorServices.getSingleDoctorPublicProfile(doctorId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor profile retrieved successfully.",
        data: result,
    });
});

export const DoctorController = {
    applyingAsDoctor,
    verifiDoctorEmail,
    approvedDoctor,
    getAllDoctors,
    getSingleDoctorAdminProfile,
    updateMyDoctorProfile,
    getAvailableDoctorByTodaysSchedule,
    getAllDoctorsListPublic,
    getSingleDoctorPublicProfile
}