import z from "zod";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { NextFunction, Request, Response } from "express";

export const validateRequest = (zodSchema: z.ZodObject) =>{
    return catchAsync ((req: Request, res: Response, next: NextFunction) =>{
        const payload = req.body ?? {}

        const result = zodSchema.safeParse(payload);

        if (!result.success) {
            console.log(result.error)
            console.log(result.error.message)
            throw new AppError(400, result.error.issues[0].message)
        }

        req.body = result.data;

        next();
    });
};