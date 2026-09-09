import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { ScheduleController } from "./schedule.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { createScheduleValidationSchema } from "./schedule.validation";


const router = Router();

router.post("/create", auth(Role.DOCTOR), validateRequest(createScheduleValidationSchema), ScheduleController.createSchedule);

router.get("/my-schedules", auth(Role.DOCTOR), ScheduleController.getMySchedules);

router.get("/schedules", auth(Role.ADMIN, Role.SUPER_ADMIN), ScheduleController.getAllSchedules);

router.get("/:id", auth(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR), ScheduleController.getScheduleById);


export const ScheduleRoutes = router;