import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums";
import { IDoctor } from "../doctor/doctor.interface";

export interface IUser {
    id: string;
    name: string;
    email: string;
    password?: string | null;
    googleId?: string | null;
    authProvider: AuthProvider;
    emailVerified: boolean;
    role: Role;
    status: UserStatus;
    needPasswordChange: boolean;
    isDeleted: boolean;
    imagePublicId: string;
    imageUrl: string;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    doctor?: IDoctor | null;
}