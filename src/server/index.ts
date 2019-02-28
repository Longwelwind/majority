import * as express from "express";
import {Server} from "ws";
import GlobalServer from "./GlobalServer";
import {Request, Response} from "express";
import createHttpApiRouter from "./http-api";
import {createTables} from "./database/database";
import createPrometheusRegistry from "./prometheusRegistry";

const PORT = process.env.PORT || 3000;

const app = express();

async function main() {
	// Creating the tables in the database
	await createTables();

	// Serving the static content to the users
	app.use(express.static("public"));

	const index = app.listen(PORT, () => console.log(`Listening on ${ PORT }`));

	// Launching the websocket
	const wss = new Server({ server: index });

	const globalServer = new GlobalServer(wss);
	globalServer.start();

	// Creating the Prometheus prometheusRegistry
	const {prometheusRegistry, onRequest} = createPrometheusRegistry(globalServer);

	// Serving the HTTP API
	const httpApiRouter = createHttpApiRouter(globalServer);
	app.use("/api", httpApiRouter, (req: Request, res: Response) => res.sendStatus(404));
	app.use("/metrics", (req: Request, res: Response) => {
		onRequest();
		res.set("Content-Type", prometheusRegistry.contentType);
		res.end(prometheusRegistry.metrics());
	})
}

main();
