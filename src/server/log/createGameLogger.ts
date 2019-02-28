import {format, Logger} from "winston";
import createBaseLogger from "./createBaseLogger";
import addLabel from "./addLabel";

export default function createGameLogger(gameId: number): Logger {
	return createBaseLogger(
		addLabel("gameId", gameId.toString())
	);
}