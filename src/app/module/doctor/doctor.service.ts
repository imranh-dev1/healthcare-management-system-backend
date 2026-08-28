import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma"
import { IDoctor } from "./doctor.interface"
import { cloudinary } from "../../lib/cloudinary";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import config from "../../config";
import { Role } from "../../../generated/prisma/enums";


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

    return doctorResult;

}

export const DoctorServices = {
    applyingAsDoctor
}