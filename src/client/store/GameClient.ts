import {observable} from "mobx";
import Game, {GameFinishState, Player, QuestionGameState, TimerBeforeBeginGameState, WaitingGameState} from "./Game";
import {ServerPacket} from "../../commons/server-packets";
import {ClientPacket} from "../../commons/client-packets";


export default class GameClient {
	PING_FREQUENCY = 5000;
	@observable connectionState: ConnectionState = ConnectionState.CONNECTING;
	websocket: WebSocket;

	@observable currentGame: Game | null = null;
	@observable selfPlayer: {id: number, name: string, token: string} | null = null;
	pingLoop: any | null = null;

	onConnect: (() => void) | null = null;
	onAuthentication: ((player_id: number, name: string, token: string) => void) | null = null;

	constructor(ws: WebSocket) {
		// Try to connected with the server
		this.websocket = ws;
		this.connectionState = ConnectionState.CONNECTING;

		this.websocket.onopen = () => this.onWebsocketOpen();
		this.websocket.onerror = () => this.onWebsocketError();
	}

	onWebsocketOpen() {
		this.connectionState = ConnectionState.CONNECTED;

		this.websocket.onmessage = event => this.onMessage(event);
		this.websocket.onclose = () => this.onWebsocketClose();

		// Start the ping/pong loop
		this.pingLoop = setInterval(() => {
			this.sendPacket({type: "ping"});
		}, this.PING_FREQUENCY);

		if (this.onConnect) {
			this.onConnect();
		}
	}

	onWebsocketError() {
		this.connectionState = ConnectionState.ERROR_CONNECTING;
	}

	onWebsocketClose() {
		this.connectionState = ConnectionState.DISCONNECTED;
		clearInterval(this.pingLoop);
	}

	onMessage(event: MessageEvent) {
		const packet: ServerPacket = JSON.parse(event.data);

		if (packet.type == "authenticate") {
			this.selfPlayer = {
				id: packet.id,
				name: packet.name,
				token: packet.token
			};

			if (this.onAuthentication) {
				this.onAuthentication(packet.id, packet.name, packet.token);
			}

			if (packet.game != null) {
				this.currentGame = Game.fromRetransmittedGame(packet.game);
			} else {
				this.joinGame();
			}

			this.connectionState = ConnectionState.CONNECTED;
		} else if (packet.type == "join-game") {
			let players: Player[] = packet.players.map((p: Player) => {
				return {
					id: p.id,
					name: p.name
				};
			});

			this.currentGame = new Game(players, new WaitingGameState(packet.maxPlayers));
		}

		if (this.currentGame != null) {
			if (this.selfPlayer == null) {
				console.error("selfPlayer == null while in-game");
				return;
			}

			if (this.currentGame.gameState instanceof  WaitingGameState) {
				if (packet.type == "new-player") {
					this.currentGame.players.push(packet.player);
				} else if (packet.type == "remove-player") {
					let i = this.currentGame.players.map(p => p.id).indexOf(packet.player_id);

					if (i == -1) {
						console.error("remove-player received but player not in-game");
						return;
					}

					this.currentGame.players.splice(i, 1);

					// We have ourselves left the game
					if (packet.player_id == this.selfPlayer.id) {
						this.currentGame = null;
					}
				} else if (packet.type == "timer-before-begin") {
					this.currentGame.gameState = new TimerBeforeBeginGameState(
						new Date(packet.begin),
						packet.duration
					)
				}
			} else if (this.currentGame.gameState instanceof TimerBeforeBeginGameState) {
				if (packet.type == "game-begin") {
					this.currentGame.gameState = new QuestionGameState(
						[],
						new Map<number, number>(),
						new Map<number, number>([...packet.playerLifes]),
					);
				}
			} else if (this.currentGame.gameState instanceof QuestionGameState) {
				let gameState = this.currentGame.gameState;

				if (packet.type == "new-question") {
					gameState.playerAnswers = new Map<number, number>();
					gameState.resultBegin = null;
					gameState.resultDuration = null;
					gameState.questionDuration = packet.duration;
					gameState.questionBegin = new Date(packet.begin_timestamp);
					gameState.questions.push(packet.question);
				} else if (packet.type == "player-answer") {
					gameState.playerAnswers.set(packet.player_id, packet.answer);
				} else if (packet.type == "question-results") {
					gameState.playerAnswers = new Map<number, number>([...packet.playerAnswers]);

					for (let [player_id, life] of packet.playersDamaged) {
						gameState.playerLifes.set(player_id, life);
					}

					gameState.resultBegin = new Date(packet.resultBeginTimestamp);
					gameState.resultDuration = packet.resultDuration;
					gameState.winningAnswers = packet.winningAnswers;
				} else if (packet.type == "game-finish") {
					this.currentGame.gameState = new GameFinishState(packet.winners);
				}
			} else if (this.currentGame.gameState instanceof GameFinishState) {
				if (packet.type == "remove-player") {
					if (this.selfPlayer.id == packet.player_id) {
						this.currentGame = null;
					}
				}
			}
		}
	}

	sendPacket(packet: ClientPacket) {
		this.websocket.send(JSON.stringify(packet));
	}

	newPlayer(name: string) {
		this.sendPacket({
			type: "authentication",
			player_id: null,
			token: null,
			name
		});
	}

	authenticate(player_id: number, name: string, token: string) {
		this.connectionState = ConnectionState.AUTHENTICATING;
		// When the player authenticates, he provides an id and a token,
		// if the authentication fails, the server will create him a new
		// account with the given name.
		this.sendPacket({
			type: "authentication",
			name: name,
			player_id,
			token
		});
	}

	joinGame() {
		if (this.currentGame != null && !(this.currentGame.gameState instanceof GameFinishState)) {
			console.error("currentGame is not null when authenticate called");
			return;
		}

		this.sendPacket({
			type: "join-game"
		});
	}

	chooseAnswer(answer: number) {
		if (this.currentGame == null) {
			console.error("chooseAnswer called when currentGame == null");
			return;
		}

		if (!(this.currentGame.gameState instanceof QuestionGameState)) {
			console.error("chooseAnswer called but gameState is " + this.currentGame.gameState.constructor.name);
			return;
		}

		this.sendPacket({
			type: "answer-question",
			answer
		});
	}

	isSelfPlayer(player: Player): boolean {
		if (this.selfPlayer == null) {
			return false;
		}
		return this.selfPlayer.id == player.id;
	}
}

export enum ConnectionState {
	CONNECTING,
	ERROR_CONNECTING,
	CONNECTED,
	AUTHENTICATING,
	DISCONNECTED
}
