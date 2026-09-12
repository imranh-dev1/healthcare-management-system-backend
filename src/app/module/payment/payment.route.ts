import express from "express";
import { PaymentController } from "./payment.controller";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";

const router = express.Router();

// Get my payments
router.get("/my-payments", auth(Role.PATIENT), PaymentController.getMyPayment);

// Get all payments
router.get("/", auth(Role.ADMIN, Role.SUPER_ADMIN), PaymentController.getAllPayments);

// Get single payment
router.get("/:paymentId", auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN), PaymentController.getSinglePayment);


export const PaymentRoutes = router; 
