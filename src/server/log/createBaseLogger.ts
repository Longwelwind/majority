import {createLogger, Logger, transports, format} from "winston";
import {Format} from "logform";
import {DATABASE_CLIENT, DATABASE_URL} from "../database/database";
// @ts-ignore
import {Postgres} from "winston-postgres";

const NODE_ENV = process.env.NODE_ENV || "production";

export default function createBaseLogger(...additionalFormats: Format[]): Logger {
	let formats = [
		format.timestamp(),
		...additionalFormats,
	];

	if (NODE_ENV == "production") {
		formats.push(format.json());
	} else {
		formats.push(format.simple());
	}

	let winstonTransports = [
		new transports.Console()
	];

	if (DATABASE_CLIENT == "postgres") {
		winstonTransports.push(new Postgres({
			ssl: false,
			connectionString: DATABASE_URL,
			tableName: "logs",
			timestamp: true
		}));
	}

	return createLogger({
		level: NODE_ENV == "production" ? "info" : "warn",
		format: format.combine(...formats),
		transports: winstonTransports
	});
}
