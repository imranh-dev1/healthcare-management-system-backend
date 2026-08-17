import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";


const profileImageUpload = catchAsync(async (req: Request, res: Response)=>{

    console.log(req.file)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Profile image Uploded Successfully",
        data: null
    })

})

export const UserController = {
    profileImageUpload
}