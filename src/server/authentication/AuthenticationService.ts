import Player from "../Player";
import database from "../database/database";


export default class AuthenticationService {
	static async getPlayer(id: number): Promise<{id: number, name: string, token: string} | null> {
		let data = await database("users").where("id", id.toString()).first();

		if (!data) {
			return null;
		}

		return new Player(data["id"], data["name"], data["token"]);
	}

	static async createPlayer(name: string, token: string): Promise<Player> {
		const id = (await database("users").insert({
			name,
			token
		}).returning("id"))[0];

		return new Player(id, name, token);
	}
}
