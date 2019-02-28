import {json, NextFunction, Request, Response, Router} from "express";
import GlobalServer from "./GlobalServer";
import Game, {GameStateType} from "./Game";
import {http} from "winston";

const TOKEN = process.env.HTTP_API_TOKEN || "default-token";

if (TOKEN == "default-token") {
	console.warn("/!\\ HTTP API Token was left to the default value");
	console.warn("/!\\ Set HTTP_API_TOKEN env variable to change that");
}

function canAccess(req: Request, res: Response, next: NextFunction) {
	if (req.query.token != TOKEN) {
		res.sendStatus(401);
		return;
	}
	next();
}

export default function createHttpApiRouter(globalServer: GlobalServer): Router {
	const httpApiRouter = Router();

	httpApiRouter.use(canAccess);
	httpApiRouter.use(json());

	httpApiRouter.get('/games', (req, res) => {
		res.json({
			games: globalServer.ongoingGames.map(g => ({
				id: g.id,
				players: g.players.map(p => ({
					id: p.id,
					name: p.name
				})),
				state: g.state.type == GameStateType.WAITING ? {
					type: "waiting"
				} : g.state.type == GameStateType.QUESTION ? {
					type: "question",
					nQuestion: g.state.questions.length + 1
				} : g.state.type == GameStateType.RESULTS ? {
					// Will never happen because a game going into
					// RESULTS state is taken out of ongoingGames
				} : {}
			}))
		});
	});

	httpApiRouter.get("/players", (req, res) => {
		res.json({
			players: globalServer.connectedPlayers.map(p => ({
				id: p.id,
				name: p.name
			}))
		});
	});

	httpApiRouter.get("/players/count", (req, res) => {
		res.json({
			"count": Game.MAX_PLAYERS
		});
	});

	httpApiRouter.post("/players/count", (req, res) => {
		Game.MAX_PLAYERS = req.body.count;
		res.json({
			"status": "ok"
		})
	});

	return httpApiRouter;
}
