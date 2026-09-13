import { Prisma } from "../../../generated/prisma/client";

export interface IDoctor {
    user: {
        name: string;
        email: string;
    };

    doctor: {
        address?: string | null;
        specialization: string;
        licenseNumber: string;
        qualification: string;
        experinenceYears: number;
        bio?: string | null;
        consultationFee?: number | null;
        contactNumber?: string | null;
    };
}

export interface IDoctorEmailVerify {
    otp: string,
    email: string
}

export interface IApproveDoctor {
    doctorId: string;
    verificationStatus: string;
    rejectionReson: string
}

export interface IUpdateDoctorPayload {
    name?: string;
    address?: string;
    specialization?: string;
    qualification?: string;
    experinenceYears?: number;
    bio?: string;
    consultationFee?: number;
    contactNumber?: string;
    resume?: string;
    resumePublicId?: string;
    additionalFiles?: Prisma.InputJsonValue;
}