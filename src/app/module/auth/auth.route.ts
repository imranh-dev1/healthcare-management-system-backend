import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { userValidation } from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(userValidation.registerPatientSchema), AuthController.registerPatient);

router.post("/login", validateRequest(userValidation.loginPatientSchema), AuthController.loginUser);

router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);

router.post("/google", AuthController.googleLogin);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/forgot-password", validateRequest(userValidation.ForgotPasswordZodSchema), AuthController.forgotPassword);

router.post("/reset-password",validateRequest(userValidation.ResetPasswordZodSchema), AuthController.resetPassword);

export const AuthRoutes = router;
