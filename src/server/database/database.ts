import * as knex from "knex";

export const DATABASE_URL = process.env.DATABASE_URL || "sqlite";
export const DATABASE_CLIENT = DATABASE_URL.startsWith("postgres")
	? "postgres"
	: DATABASE_URL.startsWith("sqlite")
		? "sqlite"
		: null;

if (DATABASE_CLIENT == null) {
	throw new Error("DATABASE_CLIENT couldn't be find");
}

if (DATABASE_CLIENT == "postgres") {
	console.log("Connecting to PostgreSQL database");
} else {
	console.log("Creating local sqlite database");
}

const database = DATABASE_CLIENT == "postgres"
	? knex({
		client: DATABASE_CLIENT,
		connection: DATABASE_URL,
		useNullAsDefault: true
	}) : knex({
		client: DATABASE_CLIENT,
		connection: {filename: "data.sqlite"},
		useNullAsDefault: true
	});

export async function createTables() {
	if (!await database.schema.hasTable("users")) {
		await database.schema.createTable("users", table => {
			table.increments("id");
			table.string("name").notNullable();
			table.string("token").notNullable();
		});
	}

	if (!await database.schema.hasTable("logs")) {
		await database.schema.createTable("logs", table => {
			table.string("level");
			table.string("message");
			table.json("meta");
		});
	}
}


export default database;
