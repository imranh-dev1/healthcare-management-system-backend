import { Router } from "express";
import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { ApproveDoctorValidationSchema, DoctorValidation } from "./doctor.validation";

const router = Router();

router.post("/applying-as-doctor", upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 10 },
    { name: 'data', maxCount: 1 }
]), DoctorController.applyingAsDoctor)

router.post("/applying-as-doctor/email-verify", DoctorController.verifiDoctorEmail);

router.post("/approved-doctor", auth(Role.ADMIN, Role.SUPER_ADMIN), validateRequest(ApproveDoctorValidationSchema), DoctorController.approvedDoctor);

router.get("/all-doctors", auth(Role.ADMIN, Role.SUPER_ADMIN), DoctorController.getAllDoctors);

router.get("/admin/doctors/:doctorId", auth(Role.ADMIN, Role.SUPER_ADMIN), DoctorController.getSingleDoctorAdminProfile);

router.patch("/update-my-profile", auth(Role.DOCTOR), validateRequest(DoctorValidation.updateDoctorSchema), DoctorController.updateMyDoctorProfile);

// Public doctor list
router.get("/public-doctors", DoctorController.getAllDoctorsListPublic);

// Public single doctor profile
router.get("/public-doctors/:doctorId", DoctorController.getSingleDoctorPublicProfile);

// Available doctors by today's schedules
router.get("/available-doctors-today", auth(Role.PATIENT), DoctorController.getAvailableDoctorByTodaysSchedule);

export const DoctorRoutes = router;