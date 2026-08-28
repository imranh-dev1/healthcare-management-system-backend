import { Router } from "express";
import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";

const router = Router();

router.post("/applying-as-doctor", upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 10 }
]), DoctorController.applyingAsDoctor)

export const DoctorRoutes = router;