import Game from "./Game";
import {ServerPacket} from "../commons/server-packets";
import * as WebSocket from "ws";

export default class Player {
	static lastId: number = 0;

	id: number;
	name: string;
	token: string;
	game: Game | null = null;
	clients: WebSocket[] = [];

	constructor(id: number, nickname: string, token: string) {
		this.id = id;
		this.name = nickname;
		this.token = token;
	}

	sendPacket(packet: ServerPacket) {
		this.clients.forEach(c => {
			if (c.readyState == WebSocket.OPEN) {
				c.send(JSON.stringify(packet));
			}
		});
	}
}