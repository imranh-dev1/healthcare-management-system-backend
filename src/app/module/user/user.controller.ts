import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserServices } from "./user.service";


const profileImageUpload = catchAsync(async (req: Request, res: Response)=>{

    if (!req.file) {
        throw new Error("Profile image not Provided.")
    }
    if (!req.user?.userId) {
        throw new Error("User Not Found, this profile image upload.")
    }

    const result = await UserServices.profileImageUpload(req.file.buffer, req.user?.userId); 

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Profile image Uploded Successfully",
        data: result,
    })

})

export const UserController = {
    profileImageUpload
}