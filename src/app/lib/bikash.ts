import config from "../config";
import { redisClient } from "./redis";
import { AppError } from "../utils/AppError";

export const getBikashGrantIdToken = async () => {
	try {
		const ID_TOKEN_KEY = "bikash:idToken";
		const REFRESH_TOKEN_KEY = "bikash:refreshToken";

		const idTokenTTL = await redisClient.ttl(ID_TOKEN_KEY);
		const refreshTokenTTL = await redisClient.ttl(REFRESH_TOKEN_KEY);

		const idToken = await redisClient.get(ID_TOKEN_KEY);
		const refreshToken = await redisClient.get(REFRESH_TOKEN_KEY);

		if (idToken && idTokenTTL > 600) {
			return idToken;
		}

		if ((idTokenTTL <= 600 || !idToken) && refreshToken  && refreshTokenTTL > 600) {
			const response = await fetch(
				`${config.bikash_sendbox_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						Accept: "application/json",
						username: config.bikash_username,
						password: config.bikash_passwprd,
					},
					body: JSON.stringify({
						app_key: config.bikash_app_key,
						app_secret: config.bikash_app_secret,
						refresh_token: refreshToken,
					}),
				},
			);

			if (response.ok) {
				const result = await response.json();

				await redisClient.set(ID_TOKEN_KEY, result.id_token, {
					expiration: {
						type: "EX",
						value: 60 * 60,
					},
				});

				return result.id_token;
			}
		}

		const response = await fetch(
			`${config.bikash_sendbox_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					Accept: "application/json",
					username: config.bikash_username,
					password: config.bikash_passwprd,
				},
				body: JSON.stringify({
					app_key: config.bikash_app_key,
					app_secret: config.bikash_app_secret,
				}),
			},
		);

		if (!response.ok) {
			throw new AppError(502, "Bkash Access Token Grant Failed");
		}

		const result = await response.json();

		await redisClient.set(ID_TOKEN_KEY, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});

		await redisClient.set(REFRESH_TOKEN_KEY, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});
 
		return result.id_token;
	} catch (error: any) {
		throw new AppError(502, error.message || "Failed to get Bkash ID token");
	}
};
