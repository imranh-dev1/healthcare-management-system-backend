import { Router } from "express";
import { AppointmentController } from "./appointment.controller";

const router = Router();

router.post("/book-appointment", AppointmentController.bookAppointment);

// router.get("/appointment/book-appointment/payment/callback",);

export const AppointmentRoutes = router;