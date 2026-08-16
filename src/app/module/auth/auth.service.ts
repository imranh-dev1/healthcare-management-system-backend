import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPassword,
} from "./auth.interface";
import { googleClient } from "../../lib/googleAuth";
import type { TokenPayload } from "google-auth-library";
import crypto from "crypto"
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const createdUser = await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: false,
			patient: {
				create: { name, email },
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new Error(
			"User Already Has Account Registerd with Google, try to login with google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const tiket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_clint_id,
		});

		googleIdTokenPayload = tiket.getPayload();
	} catch (error) {
		console.log("Google id Token Verification Faild", error);
		throw new Error("Invalid or Expired Google Id Token");
	}

	if (!googleIdTokenPayload) {
		throw new Error("Invalid or Expired Google Id Token");
	}

	if (!googleIdTokenPayload.email) {
		throw new Error("Google email not found");
	}

	if (!googleIdTokenPayload.name) {
		throw new Error("Google email User name not found");
	}

	const ifPatientExsitWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = ifPatientExsitWithGoogleAuth;

	if (!ifPatientExsitWithGoogleAuth) {
		const ifPatientExistWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (ifPatientExistWithCredentials) {
			if (!ifPatientExistWithCredentials.emailVerified) {
				throw new Error("User Email not verified");
			}

			if (ifPatientExistWithCredentials.status === UserStatus.BLOCKED) {
				throw new Error("User is Blocked");
			}

			if (
				ifPatientExistWithCredentials.isDeleted ||
				ifPatientExistWithCredentials.status === UserStatus.DELETED
			) {
				throw new Error("User is Deleted");
			}

			user = await prisma.user.update({
				where: {
					id: ifPatientExistWithCredentials.id,
				},
				data: {
					googleId: googleIdTokenPayload.sub,
				},
			});
		} else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});
		}
	}

	if (!user) {
		throw new Error("User Not Found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is Blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is Deleted");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};
 
const forgotPassword = async (payload: IForgotPasswordPayload) =>{

	const isUserExist = await prisma.user.findUnique({
		where: {
			email: payload.email
		}
	})

	if (!isUserExist) {
		throw new Error("User Dose Not Exist!")
	}

	if (isUserExist.status === "BLOCKED") {
		throw new Error("User is BLocked, Contact sport, and try again..")
	}
	if (isUserExist.status === "DELETED") {
		throw new Error("User is Deleted, Contact sport, and try again..")
	}

	if (!isUserExist.emailVerified) {
		throw new Error("User Email not verified.")
	}

	if (isUserExist.googleId && isUserExist.authProvider === "GOOGLE") {
		throw new Error("This User Has Account With Google Login...")
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const otpKey = `forgot-password-otp:${isUserExist.email}`;

	const expirationSeconds = 5 * 60

	await redisClient.set(otpKey, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds
		}
	}) 

	await transporter.sendMail({
    from: `"PH Healthcare" <${config.smtp_emai_sender}>`,
    to: isUserExist.email,
    subject: "Your PH Healthcare Password Reset OTP",
    text: `Your PH Healthcare password reset OTP is ${otp}. This OTP will expire shortly. If you did not request a password reset, please ignore this email.`,
    html: `
        <div style="margin:0; padding:40px 20px; background-color:#f4f7fb; font-family:Arial, Helvetica, sans-serif;">
            <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

                <!-- Header -->
                <div style="padding:28px 32px; background:#0f766e; text-align:center;">
                    <h1 style="margin:0; color:#ffffff; font-size:24px;">
                        PH Healthcare
                    </h1>
                </div>

                <!-- Content -->
                <div style="padding:35px 32px;">
                    <h2 style="margin:0 0 16px; color:#1f2937; font-size:22px;">
                        Reset Your Password
                    </h2>

                    <p style="margin:0 0 20px; color:#4b5563; font-size:15px; line-height:1.6;">
                        We received a request to reset the password for your PH Healthcare account.
                        Use the verification code below to continue.
                    </p>

                    <!-- OTP -->
                    <div style="margin:28px 0; padding:20px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; text-align:center;">
                        <p style="margin:0 0 8px; color:#64748b; font-size:13px;">
                            Your verification code
                        </p>

                        <div style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#0f766e;">
                            ${otp}
                        </div>
                    </div>

                    <p style="margin:0 0 12px; color:#4b5563; font-size:14px; line-height:1.6;">
                        This OTP is valid for a limited time. Please do not share this code with anyone.
                    </p>

                    <div style="margin-top:24px; padding:14px 16px; background:#fff7ed; border-left:4px solid #f97316; border-radius:4px;">
                        <p style="margin:0; color:#9a3412; font-size:13px; line-height:1.5;">
                            <strong>Security notice:</strong> If you did not request a password reset,
                            you can safely ignore this email.
                        </p>
                    </div>

                    <p style="margin:30px 0 0; color:#6b7280; font-size:14px; line-height:1.6;">
                        Regards,<br />
                        <strong style="color:#374151;">PH Healthcare Team</strong>
                    </p>
                </div>

                <!-- Footer -->
                <div style="padding:20px 32px; background:#f8fafc; text-align:center;">
                    <p style="margin:0; color:#94a3b8; font-size:12px;">
                        © ${new Date().getFullYear()} PH Healthcare. All rights reserved.
                    </p>
                </div>

            </div>
        </div>
    `});
}

const resetPassword = async (payload: IResetPassword) => {

	const {newPassword, otp, email} = payload;  

	const isUserExist = await prisma.user.findUnique({
		where: {
			email: email
		}
	})

	if (!isUserExist) {
		throw new Error("User Dose Not Exist!")
	}

	if (isUserExist.status === "BLOCKED") {
		throw new Error("User is BLocked, Contact sport, and try again..")
	}
	if (isUserExist.status === "DELETED") {
		throw new Error("User is Deleted, Contact sport, and try again..")
	}

	if (!isUserExist.emailVerified) {
		throw new Error("User Email not verified.")
	}

	if (isUserExist.googleId && isUserExist.authProvider === "GOOGLE") {
		throw new Error("This User Has Account With Google Login...")
	} 

	const otpKey = `forgot-password-otp:${isUserExist.email}`;

	const storedOtp = await redisClient.get(otpKey);

	if (!storedOtp) {
		throw new Error("OTP has expired.");
	}

	if (storedOtp !== otp) {
		throw new Error("Invalid OTP.");
	}

	const hashedPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));

	await prisma.user.update({
		where: {
			email: isUserExist.email
		},
		data: {
			password: hashedPassword
		}
	})

	await redisClient.del([otpKey]);

	await transporter.sendMail({
    from: `"PH Healthcare" <${config.smtp_emai_sender}>`,
    to: isUserExist.email,
    subject: "PH Healthcare Password Reset Successful",
    text: `Your PH Healthcare account password has been successfully reset. If you did not make this change, please contact our support team immediately.`,
    html: `
        <div style="margin:0; padding:40px 20px; background-color:#f4f7fb; font-family:Arial, Helvetica, sans-serif;">
            <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">

                <!-- Header -->
                <div style="padding:28px 32px; background:#0f766e; text-align:center;">
                    <h1 style="margin:0; color:#ffffff; font-size:24px;">
                        PH Healthcare
                    </h1>
                </div>

                <!-- Content -->
                <div style="padding:35px 32px;">

                    <h2 style="margin:0 0 16px; color:#1f2937; font-size:22px;">
                        Password Reset Successful
                    </h2>

                    <p style="margin:0 0 20px; color:#4b5563; font-size:15px; line-height:1.6;">
                        Your PH Healthcare account password has been successfully
                        reset.
                    </p>

                    <div style="
                        margin:24px 0;
                        padding:18px 20px;
                        background:#f0fdf4;
                        border:1px solid #bbf7d0;
                        border-radius:8px;
                    ">
                        <p style="margin:0; color:#166534; font-size:14px; line-height:1.6;">
                            <strong>Your password has been updated successfully.</strong><br />
                            You can now sign in to your account using your new password.
                        </p>
                    </div>

                    <div style="
                        margin-top:24px;
                        padding:14px 16px;
                        background:#fff7ed;
                        border-left:4px solid #f97316;
                        border-radius:4px;
                    ">
                        <p style="margin:0; color:#9a3412; font-size:13px; line-height:1.5;">
                            <strong>Security notice:</strong>
                            If you did not request this password reset, please contact
                            our support team immediately.
                        </p>
                    </div>

                    <p style="margin:30px 0 0; color:#6b7280; font-size:14px; line-height:1.6;">
                        Regards,<br />
                        <strong style="color:#374151;">PH Healthcare Team</strong>
                    </p>

                </div>

                <!-- Footer -->
                <div style="padding:20px 32px; background:#f8fafc; text-align:center;">
                    <p style="margin:0; color:#94a3b8; font-size:12px;">
                        © ${new Date().getFullYear()} PH Healthcare. All rights reserved.
                    </p>
                </div>

            </div>
        </div>
    `});
}

export const AuthService = {
	registerPatient,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	resetPassword,
	forgotPassword
};
