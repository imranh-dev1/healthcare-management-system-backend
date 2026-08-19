import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { redisClient } from "./app/lib/redis";
import crypto from "crypto"
import { UserRoutes } from "./app/module/user/user.route";
import { getBikashGrantIdToken } from "./app/lib/bikash";


const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

// test route 
app.get("/test", async (req: Request, res: Response) => {

	try {

		const bikashGrantTokenId = await getBikashGrantIdToken();
		console.log(bikashGrantTokenId)
 
		res.status(httpStatus.OK).json({
			success: true,
			message: "Welcome to PH Healthcare System Backend Bikash initialize test",
			data: null
		});
		
	} catch (error) {
		console.log(error)
	}
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
