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
import { ChainIds } from "../types/chains";

/**
 * Controller to handle retrieving all collected events for a given integrator.
 * GET /events/integrator/:chainId/:integrator
 */
export const getEventsByIntegrator: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		// Validate the integrator address and chainId from params
		const result = IntegratorParamSchema.safeParse(req.params);
		if (!result.success) {
			res.status(400).json({
				success: false,
				error: result.error.errors[0].message,
			});
			return;
		}
		const { integrator } = result.data;
		const chainId = parseInt(req.params.chainId, 10);

		// Validate chainId
		if (!Object.values(ChainIds).includes(chainId)) {
			res.status(400).json({
				success: false,
				error: `Invalid chain ID. Supported chains: ${Object.values(ChainIds)
					.filter((id) => typeof id === "number")
					.join(", ")}`,
			});
			return;
		}

		// Query the database for events with the given integrator and chain
		const eventService = EventService.getInstance();
		const events: FeeCollectedEvent[] =
			await eventService.getEventsByIntegrator(chainId, integrator);
		logger.info(
			{ chainId, integrator, count: events.length },
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

// GET /integrator/:chainId/:integrator
router.get("/integrator/:chainId/:integrator", getEventsByIntegrator);

export default router;
