import { Router } from "express";
import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { ApproveDoctorValidationSchema } from "./doctor.validation";

const router = Router();

router.post("/applying-as-doctor", upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 10 }
]), DoctorController.applyingAsDoctor)

router.post("/applying-as-doctor/email-verify", auth(Role.DOCTOR), DoctorController.verifiDoctorEmail)
router.post("/approved-doctor", auth(Role.ADMIN, Role.SUPER_ADMIN), validateRequest(ApproveDoctorValidationSchema), DoctorController.approvedDoctor)
router.get("/all-doctors", auth(Role.ADMIN, Role.SUPER_ADMIN), validateRequest(ApproveDoctorValidationSchema), DoctorController.getAllDoctors)

export const DoctorRoutes = router;