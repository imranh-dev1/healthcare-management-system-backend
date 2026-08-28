import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma"
import { IApproveDoctor, IDoctor, IDoctorEmailVerify } from "./doctor.interface"
import { cloudinary } from "../../lib/cloudinary";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import config from "../../config";
import { DoctorVerificationStatus, Role } from "../../../generated/prisma/enums";
import { redisClient } from "../../lib/redis";
import sendEmail from "../../utils/sendEmail";
import { RequestUser } from "../../middleware/checkAuth";


const applyingAsDoctor = async (payload: IDoctor, resumeFile: Express.Multer.File, additionalFiles: Express.Multer.File[]) => {
    const userAlreadyExist = await prisma.user.findUnique({
        where: {
            email: payload?.user.email
        }
    })

    console.log(payload)

    if (userAlreadyExist) {
        throw new Error("User already exists with this email.");
    }

    const resumeUploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: "auto" },
            async (error, result) => {
                if (error) {
                    return reject(error)
                }

                if (!result) {
                    return reject(new Error("No Result form Cloudanry"))
                }

                resolve(result)
            }
        ).end(resumeFile.buffer)
    })
    const additionalFilesUploadResult = await Promise.all(additionalFiles.map(file => {
        return new Promise<UploadApiResponse>((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: "auto" },
                async (error, result) => {
                    if (error) {
                        return reject(error)
                    }

                    if (!result) {
                        return reject(new Error("No Result form Cloudanry"))
                    }

                    resolve(result)
                }
            ).end(file.buffer)
        })
    }))

    const randomPassword = crypto.randomBytes(6).toString("base64url");

    const hashedPassword = await bcrypt.hash(randomPassword, Number(config.bcrypt_salt_rounds));


    const doctorResult = await prisma.user.create({
        data: {
            name: payload.user.name,
            email: payload.user.email,
            password: hashedPassword,
            role: Role.DOCTOR,

            doctor: {
                create: {
                    name: payload.user.name,
                    email: payload.user.email,

                    experinenceYears: Number(payload.doctor.experinenceYears),
                    licenseNumber: payload.doctor.licenseNumber,
                    qualification: payload.doctor.qualification,
                    specialization: payload.doctor.specialization,

                    resume: resumeUploadResult.secure_url,
                    resumePublicId: resumeUploadResult.public_id,

                    additionalFiles: additionalFilesUploadResult.map((file) => ({
                        url: file.secure_url,
                        publicId: file.public_id,
                    })),
                },
            },
        },
        include: {
            doctor: true
        },
        omit: {
            password: true
        }
    });

    const otpKey = `doctor-email-verified-otp:${payload.user.email}`;
    const otpValue = crypto.randomInt(100000, 1000000).toString();

    const expirationSeconds = 24 * 60 * 60

    await redisClient.set(otpKey, otpValue, {
        expiration: {
            type: "EX",
            value: expirationSeconds
        }
    })

    await sendEmail({
        to: payload.user.email,
        subject: "Verify Your PH Healthcare Email Address",
        template: "email-verification",
        data: {
            otpValue,
        }
    });

    return doctorResult;

}

const verifiDoctorEmail = async (payload: IDoctorEmailVerify) => {
    const otp = payload.otp;
    const email = payload.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
            role: Role.DOCTOR
        }
    })

    if (!existingUser) {
        throw new Error("Doctor Application Not Found. Please Apply Again.")
    }

    if (existingUser.emailVerified) {
        throw new Error("Email Already Verified")
    }

    const otpKey = `doctor-email-verified-otp:${email}`;
    const redisOtp = await redisClient.get(otpKey);

    if (!redisOtp) {
        throw new Error('OTP Expired. Your Application Window Has Closed, Please Apply Again.')
    }
    if (redisOtp !== otp) {
        throw new Error('OTP Does Not Match')
    }

    await redisClient.del(otpKey);

    const verifiedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: true },
        omit: { password: true },
        include: { doctor: true },
    });

    return verifiedUser
}

const approvedDoctor = async (payload: IApproveDoctor, reviewer: RequestUser) => {

    const { doctorId, verificationStatus, rejectionReson } = payload;

    const doctor = await prisma.doctor.findUnique({
        where: {
            id: doctorId,
        },
        include: {
            user: true
        }
    });

    if (!doctor) {
        throw new Error("Doctor not found.");
    }

    if (doctor.isDeleted || doctor.user.isDeleted) {
        throw new Error("Doctor Has been Deleted.");
    }
    if (!doctor.user.emailVerified) {
        throw new Error("Doctor email has not been verified.");
    }

    if (doctor.verificationStatus === "APPROVED") {
        throw new Error("Doctor is already approved. Application Cannot Reviwed");
    }

    if (doctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
        throw new Error(
            `Doctor application has Already Been ${String(doctor.verificationStatus).toLowerCase()}.`
        );
    }

    if (verificationStatus === DoctorVerificationStatus.REJECT && !rejectionReson) {
        throw new Error("Rejection reason is required when rejecting a doctor application.");
    }

    const normalizedVerificationStatus = verificationStatus as DoctorVerificationStatus;

    const approvedDoctor = await prisma.doctor.update({
        where: {
            id: payload.doctorId,
        },
        data: {
            verificationStatus: normalizedVerificationStatus,
            rejectionReason: verificationStatus === DoctorVerificationStatus.REJECT ? rejectionReson : null,
            reviewedBy: reviewer.userId,
            reviewdAt: new Date(),
        },
        include: {
            user: true,
        },
    });

    await sendEmail({
        to: doctor.email,
        subject:
            normalizedVerificationStatus === DoctorVerificationStatus.APPROVED
                ? "Your PH Healthcare Doctor Application Has Been Approved"
                : "Update on Your PH Healthcare Doctor Application",
        template:
            normalizedVerificationStatus === DoctorVerificationStatus.APPROVED
                ? "doctor-application-approved"
                : "doctor-application-rejected",
        data: {
            doctorName: doctor.name,
            rejectionReason:
                normalizedVerificationStatus === DoctorVerificationStatus.REJECT ? rejectionReson : undefined,
        },
    });

    return approvedDoctor;
};

const getAllDoctors = async () => {

    const allDoctors = await prisma.doctor.findMany({});

    return allDoctors

}

export const DoctorServices = {
    applyingAsDoctor,
    verifiDoctorEmail,
    approvedDoctor,
    getAllDoctors

}