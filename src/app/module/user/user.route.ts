import { Router } from "express"; 
import { UserController } from "./user.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.patch("/profile-image-upload", auth(Role.SUPER_ADMIN, Role.ADMIN, Role.DOCTOR, Role.PATIENT), upload.single("profile-image"), UserController.profileImageUpload)

export const UserRoutes = router;