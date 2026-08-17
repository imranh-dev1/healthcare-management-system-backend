import { Router } from "express"; 
import { UserController } from "./user.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.patch("/profile-image-upload", upload.single("profile-image"), UserController.profileImageUpload)

export const UserRoutes = router;