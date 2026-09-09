import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { ScheduleController } from "./schedule.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { createScheduleValidationSchema } from "./schedule.validation";


const router = Router();

router.post("/create", auth(Role.DOCTOR), validateRequest(createScheduleValidationSchema), ScheduleController.createSchedule)

export const ScheduleRoutes = router;