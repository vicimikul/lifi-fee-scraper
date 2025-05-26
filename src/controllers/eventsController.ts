import {
	Request,
	Response,
	NextFunction,
	Router,
	RequestHandler,
} from "express";
import { EventService } from "../services/eventService";
import logger from "../utils/logger";
import { FeeCollectedEvent } from "../types/events";
import { IntegratorParamSchema } from "../types/schemas";
/**
 * Controller to handle retrieving all collected events for a given integrator.
 * GET /events/integrator/:integrator
 */
export const getEventsByIntegrator: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		// Validate the integrator address from params using safeParse
		const result = IntegratorParamSchema.safeParse(req.params);
		if (!result.success) {
			res.status(400).json({
				success: false,
				error: result.error.errors[0].message,
			});
			return;
		}
		const { integrator } = result.data;

		// Query the database for events with the given integrator
		const eventService = new EventService();
		const events: FeeCollectedEvent[] =
			await eventService.getEventsByIntegrator(integrator);
		logger.info(
			{ integrator, count: events.length },
			"Fetched events for integrator"
		);
		res.json({
			success: true,
			data: { events },
			meta: {
				count: events.length,
				timestamp: Date.now(),
			},
		});
	} catch (error) {
		logger.error({ error }, "Failed to fetch events for integrator");
		next(error);
	}
};

// Express router setup
const router = Router();

// GET /integrator/:integrator
router.get("/integrator/:integrator", getEventsByIntegrator);

export default router;
