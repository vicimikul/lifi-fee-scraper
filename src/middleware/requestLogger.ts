import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

export const requestLogger = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const start = Date.now();

	// Log request start
	logger.info(
		{
			type: "request_start",
			method: req.method,
			url: req.url,
			query: req.query,
			params: req.params,
			ip: req.ip,
			userAgent: req.get("user-agent"),
		},
		"Incoming request"
	);

	// Capture response
	const originalSend = res.send;
	res.send = function (body) {
		const responseTime = Date.now() - start;

		// Log request completion
		logger.info(
			{
				type: "request_end",
				method: req.method,
				url: req.url,
				statusCode: res.statusCode,
				responseTime,
				contentLength: body?.length || 0,
			},
			"Request completed"
		);

		return originalSend.call(this, body);
	};

	next();
};
