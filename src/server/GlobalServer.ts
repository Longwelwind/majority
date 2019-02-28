import * as WebSocket from "ws";
import {Server} from "ws";
import {ClientPacket} from "../commons/client-packets";
import Player from "./Player";
import Game, {GameStateType} from "./Game";
import generateToken from "../utils/generate-token";
import {GameRetransmission} from "../commons/server-packets";
import {Logger} from "winston";
import createBaseLogger from "./log/createBaseLogger";
import {IncomingMessage} from "http";
import AuthenticationService from "./authentication/AuthenticationService";
import {Simulate} from "react-dom/test-utils";
import play = Simulate.play;


export default class GlobalServer {
	websocketServer: Server;
	connectedClients: WebSocket[] = [];
	ongoingGames: Game[] = [];
	connectedPlayers: Player[] = [];
	authenticatedClients: Map<WebSocket, Player> = new Map<WebSocket, Player>();
	logger: Logger;

	constructor(websocketServer: Server) {
		this.websocketServer = websocketServer;
		this.logger = createBaseLogger();
	}

	start() {
		this.logger.info("GlobalServer starting");
		this.websocketServer.on("connection", (ws, req) => this.onClientConnect(ws, req));
	}

	onClientConnect(client: WebSocket, req: IncomingMessage) {
		this.logger.info("connection", {ip: req.connection.remoteAddress, port: req.connection.remotePort});
		this.connectedClients.push(client);

		client.on("message", message => this.onClientMessage(client, message as string));
		client.on("close", () => this.onClientClose(client));
	}

	async onClientMessage(client: WebSocket, message: string) {
		// Try parse the JSON
		let packet: ClientPacket;
		try {
			packet = JSON.parse(message);
		} catch (e) {
			this.logger.warn("couldn't parse JSON of message", {packet: message});
			return;
		}
		if (packet.type == "ping") {
			client.send(JSON.stringify({
				type: "pong"
			}));
		} if (packet.type == "authentication") {
			this.logger.info("authentication", {
				playerId: packet.player_id,
				token: packet.token,
				name: packet.name
			});
			let player: Player | null = null;
			if (packet.player_id) {
				const candidatePlayer = await AuthenticationService.getPlayer(packet.player_id);

				if (candidatePlayer && candidatePlayer.token == packet.token) {
					let {id, name, token} = candidatePlayer;
					player = this.getPlayerInstanceIfInGame(id);

					if (!player) {
						player = new Player(id, name, token);
					}
				}
			}

			if (!player) {
				const token = generateToken();
				let name = "Guest";
				if (packet.name) {
					name = packet.name
				}

				player = await AuthenticationService.createPlayer(name, token);
			}

			player.clients.push(client);
			this.authenticatedClients.set(client, player);

			if (this.connectedPlayers.indexOf(player) == -1) {
				this.connectedPlayers.push(player);
			}

			// Check if the player is already in a game and if yes,
			// send him a retransmission of the game
			let retransmittedGame: GameRetransmission | null = null;
			if (player.game != null) {
				// Send him a retransmission of the game
				retransmittedGame = player.game.toRetransmittedGame(player);
			}
			player.sendPacket({
				type: "authenticate",
				id: player.id,
				token: player.token,
				name: player.name,
				game: retransmittedGame
			});
		} else  {
			if (this.authenticatedClients.has(client)) {
				// "get"'s return type is "Player | undefined", thus the "as Player"
				// since we know the key is in the dictionary
				let player = this.authenticatedClients.get(client) as Player;

				if (packet.type == "join-game") {
					this.logger.info("join game packet", {playerId: player.id});
					// Check if he's in a game
					if (player.game != null) {
						if (player.game.state.type != GameStateType.WAITING) {
							this.logger.warn("tried to join but was already in a waiting game", {gameId: player.game.id});
							return;
						}
					}

					// Find a game for this player
					let game = this.ongoingGames.find(g => g.state.type == GameStateType.WAITING);
					// If we can't find one, create a new one
					if (game == null) {
						// Create a new game
						game = this.createGame();
					}

					if (player.game != null) {
						// Remove him from this game
						game.removePlayer(player);
					}

					game.joinPlayer(player);
				} else {
					if (player.game != null) {
						player.game.onPlayerMessage(player, packet);
					}
				}
			}
		}
	}

	createGame(): Game {
		this.logger.info("creating new game");
		let game = new Game();
		this.logger.info("new game created", {gameId: game.id});
		game.onFinish = () => {
			let i = this.ongoingGames.indexOf(game);
			if (i == -1) {
				this.logger.error("game.onFinish called but game wasn't in ongoingGames", {gameId: game.id});
				return;
			}

			this.ongoingGames.splice(i, 1);
		};
		this.ongoingGames.push(game);

		return game;

	}

	onClientClose(client: WebSocket) {
		this.logger.info("client disconnected");

		if (this.authenticatedClients.has(client)) {
			let player = this.authenticatedClients.get(client) as Player;
			let i = player.clients.indexOf(client);
			if (i != -1) {
				player.clients.splice(i, 1);

				// If this was the last client for this player, consider him
				// disconnected and make him leave a game if it was in Waiting mode
				if (player.clients.length == 0) {
					let i = this.connectedPlayers.indexOf(player);
					if (i != -1) {
						this.connectedPlayers.splice(i, 1);
					} else {
						this.logger.error("player had a client attached but was not in this.connectedPlayers", {
							playerId: player.id
						});
					}

					if (player.game != null && player.game.state.type == GameStateType.WAITING) {
						player.game.removePlayer(player);
					}
				}
			} else {
				this.logger.error("player was authenticated with client, but client was not in player.clients", {
					playerId: player.id
				});
			}

			this.authenticatedClients.delete(client);
		}

		let i = this.connectedClients.indexOf(client);
		if (i != -1) {
			this.connectedClients.splice(i, 1);
		} else {
			this.logger.error("client was not in connectedClients");
		}
	}

	getPlayerInstanceIfInGame(playerId: number): Player | null {
		let games = this.ongoingGames.filter(g => g.players.map(p => p.id).indexOf(playerId) != -1);

		if (games.length > 1) {
			this.logger.error("multiple games were found for a player", {playerId: playerId, gameIds: games.map(g => g.id)});
		}

		if (games.length == 0) {
			return null;
		}

		return games[0].players[games[0].players.map(p => p.id).indexOf(playerId)]
	}
}
