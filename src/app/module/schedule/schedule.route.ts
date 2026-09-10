import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { ScheduleController } from "./schedule.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { createScheduleValidationSchema, updateScheduleValidationSchema } from "./schedule.validation";


const router = Router();

router.post("/create-schedules", auth(Role.DOCTOR), validateRequest(createScheduleValidationSchema), ScheduleController.createSchedule);

router.get("/my-schedules", auth(Role.DOCTOR), ScheduleController.getMySchedules);

router.get("/all-schedules", auth(Role.ADMIN, Role.SUPER_ADMIN), ScheduleController.getAllSchedules);

router.get("/todays-schedules", auth(Role.PATIENT), ScheduleController.getTodaysSchedules);

router.patch("/update-schedule/:scheduleId", auth(Role.DOCTOR), validateRequest(updateScheduleValidationSchema), ScheduleController.updateSchedule);

router.patch("/publish-schedule/:scheduleId", auth(Role.DOCTOR), ScheduleController.publishSchedule);

router.get("/:scheduleId", auth(Role.ADMIN, Role.SUPER_ADMIN, Role.DOCTOR), ScheduleController.getScheduleById);

router.delete("/:scheduleId", auth(Role.DOCTOR), ScheduleController.deleteSchedule);

export const ScheduleRoutes = router;