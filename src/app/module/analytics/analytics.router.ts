import express from "express";
import { AnalyticsController } from "./analytics.controller";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";

const router = express.Router();

// Get Admin Analytics
router.get("/admin-analytics", auth(Role.ADMIN, Role.SUPER_ADMIN), AnalyticsController.getAdminAnalytics);

// Get Doctor Analytics
router.get("/doctor-analytics", auth(Role.DOCTOR), AnalyticsController.getDotorAnalytics);

// Get Patient Analytics
router.get("/patient-analytics", auth(Role.PATIENT), AnalyticsController.getPatientAnalytics);


export const AnalyticsRoutes = router; 