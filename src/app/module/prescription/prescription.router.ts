import express from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PrescriptionValidation } from "./prescription.validation";
import { PrescriptionController } from "./prescription.controller";

const router = express.Router();

// Create Prescription
router.post("/careate-prescription", auth(Role.DOCTOR), validateRequest(PrescriptionValidation.createPrescriptionSchema), PrescriptionController.createPrescription);

// Get Single Prescription
router.get("/:prescriptionId", auth(Role.DOCTOR, Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN), PrescriptionController.getSinglePrescription);

export const PrescriptionRoutes = router; 
