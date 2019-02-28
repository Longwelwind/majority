import Player from "./Player";
import {ClientPacket} from "../commons/client-packets";
import Question from "./Question";
import {GameRetransmission, ServerPacket} from "../commons/server-packets";
import {get, map_to_array} from "../utils/map";
import {range} from "../utils/range";
import {delay} from "../utils/delay";
import {Logger} from "winston";
import createGameLogger from "./log/createGameLogger";
import QuestionService from "./QuestionService";

export default class Game {
	static lastGameId: number = 0;
	static MAX_PLAYERS = 10;
	SECONDS_TO_ANSWER_QUESTION = 15;
	SECONDS_SHOW_RESULTS = 10;
	SECONDS_RESULTS_GAME = 600;
	SECONDS_TIMER_BEFORE_BEGIN = 10;

	id: number;
	state: GameState = {
		type: GameStateType.WAITING
	};
	players: Player[] = [];
	logger: Logger;

	onFinish: (() => void) | null = null;

	constructor() {
		Game.lastGameId++;
		this.id = Game.lastGameId;
		this.logger = createGameLogger(this.id);
	}

	broadcastPacket(packet: ServerPacket, except?: Player) {
		this.players.filter(p => p != except).forEach(p => p.sendPacket(packet));
	}

	joinPlayer(player: Player) {
		if (player.game != null) {
			this.logger.warn("player tried to join but is in a game", {playerId: player.id});
			return;
		}

		if (this.state.type != GameStateType.WAITING) {
			this.logger.error("joinPlayer called but game is in wrong state", {gameState: this.state.type});
			return;
		}

		this.broadcastPacket({
			type: "new-player",
			player: {
				id: player.id,
				name: player.name
			}
		});

		player.game = this;
		this.players.push(player);

		this.logger.info("player joins game", {playerId: player.id});

		player.sendPacket({
			type: "join-game",
			players: this.players.map(p => ({
				id: p.id,
				name: p.name
			})),
			maxPlayers: Game.MAX_PLAYERS
		});

		// Do we start the game ?
		if (this.players.length >= Game.MAX_PLAYERS) {
			this.startGame();
		}
	}

	removePlayer(player: Player) {
		if (this.state.type != GameStateType.WAITING && this.state.type != GameStateType.RESULTS) {
			this.logger.error("removePlayer called but game is in wrong state", {
				gameState: this.state.type
			});
			return;
		}

		if (this.state.type == GameStateType.WAITING) {
			// If a player leaves at the beginning of a game,
			// totally remove him from the game
			let i = this.players.indexOf(player);
			if (i == -1) {
				this.logger.error("removePlayer called but player is not in game", {playerId: player.id});
				return;
			}

			this.players.splice(i, 1);

			this.broadcastPacket({
				type: "remove-player",
				player_id: player.id
			});
			player.sendPacket({
				type: "remove-player",
				player_id: player.id
			});
		} else if (this.state.type == GameStateType.RESULTS) {
			// At the end of the game, don't remove connectedPlayers
			// just mark them as not connected to the game anymore
			if (player.game == this) {
				player.game = null;
			}
		}
	}

	onPlayerMessage(player: Player, packet: ClientPacket) {
		if (packet.type == "leave-game") {
			// Check if he can leave a game (In the waiting phase or results phase)
			if (this.state.type != GameStateType.WAITING && this.state.type != GameStateType.RESULTS) {
				this.logger.warn("player tried to leave a game but game was in wrong state", {
					playerId: player.id,
					gameState: this.state.type
				});
				return;
			}

			this.removePlayer(player);
		} else if (packet.type == "answer-question") {
			if (this.state.type != GameStateType.QUESTION) {
				this.logger.warn("answer-question received when game was in wrong state", {
					playerId: player.id,
					gameState: this.state.type
				});
				return;
			}

			if (this.getCurrentQuestion().playerAnswers.has(player)) {
				this.logger.warn("player has already voted", {playerId: player.id});
				return;
			}

			if (packet.answer < 0 || this.getCurrentQuestion().answers.length <= packet.answer) {
				this.logger.warn("invalid answer", {playerId: player.id, answer: packet.answer});
				return;
			}

			// A player can't vote if he is dead
			if (get(this.state.playerLifes, player) == 0) {
				this.logger.warn("player tried to answer but is dead", {playerId: player.id});
				return;
			}

			this.getCurrentQuestion().playerAnswers.set(player, packet.answer);

			this.logger.info("player answer", {
				playerId: player.id,
				answer: packet.answer,
				question: this.state.questions.length
			});

			// Send back to the player the answer he has chosen
			player.sendPacket({
				type: "player-answer",
				player_id: player.id,
				answer: packet.answer
			});

			// Send to all connectedPlayers (except the initiator) a notification
			// of the answer, without the real answer
			this.broadcastPacket({
				type: "player-answer",
				player_id: player.id,
				answer: -1
			}, player);
		}
	}

	async startGame() {
		if (this.state.type != GameStateType.WAITING) {
			this.logger.error("startGame called when game in wrong state", {gameState: this.state.type});
			return;
		}

		// Go to TimerBeforeBeginGameState
		this.state = {
			type: GameStateType.TIMER_BEFORE_BEGIN,
			begin: new Date(),
			duration: this.SECONDS_TIMER_BEFORE_BEGIN
		};

		this.broadcastPacket({
			type: "timer-before-begin",
			begin: this.state.begin.getTime(),
			duration: this.state.duration
		});

		await delay(this.state.duration);

		let playerLifes = new Map<Player, number>(this.players.map(p => [p, 3] as [Player, number]));
		this.state = {
			type: GameStateType.QUESTION,
			questions: [],
			playerLifes: playerLifes,
			questionBegin: new Date(),
			questionDuration: this.SECONDS_TO_ANSWER_QUESTION,
			resultBegin: null,
			resultDuration: null,
			winningAnswers: null
		};

		this.broadcastPacket({
			type: "game-begin",
			playerLifes: map_to_array(this.state.playerLifes).map(p => [p[0].id, p[1]] as [number, number])
		});

		this.logger.info("game started");

		this.startQuestion();
	}

	finishGame() {
		if (this.state.type != GameStateType.RESULTS) {
			this.logger.error("finishGame called but game in wrong state", {gameState: this.state.type});
			return;
		}

		this.players.forEach(player => {
			this.removePlayer(player);
		});

		this.logger.info("game finish");

		if (this.onFinish) {
			this.onFinish();
		}
	}

	async startQuestion() {
		if (this.state.type != GameStateType.QUESTION) {
			this.logger.error("startQuestion called but game in wrong state", {gameState: this.state.type});
			return;
		}

		this.state.questionBegin = new Date(),
		this.state.questionDuration = this.SECONDS_TO_ANSWER_QUESTION;
		this.state.resultBegin = null;
		this.state.resultDuration = null;

		const {question, answers} = QuestionService.getRandomQuestionAndAnswers();

		this.state.questions.push({
			text: question,
			answers,
			playerAnswers: new Map<Player, number>()
		});

		this.broadcastPacket({
			type: "new-question",
			question: {
				text: this.getCurrentQuestion().text,
				answers: this.getCurrentQuestion().answers
			},
			begin_timestamp: this.state.questionBegin.getTime(),
			duration: this.state.questionDuration
		});

		this.logger.info("question start", {
			i: this.state.questions.length,
			question: question,
			answers: answers
		});

		await delay(this.SECONDS_TO_ANSWER_QUESTION);

		this.onAnswerQuestionTimerFinish()
	}

	onAnswerQuestionTimerFinish() {
		this.finishQuestion();
	}

	async finishQuestion() {
		if (this.state.type != GameStateType.QUESTION) {
			this.logger.error("onAnswerQuestionTimerFinish when game in wrong state", {gameState: this.state.type});
			return;
		}

		let playerAnswers = this.getCurrentQuestion().playerAnswers;
		let answerCount = this.getCurrentQuestion().answers.length;

		// Tally the answers
		let tally = new Map<number, number>(range(0, answerCount).map(a => [a, 0] as [number, number]));
		playerAnswers.forEach((answer) => {
			if (answer == -1) {
				return;
			}

			tally.set(answer, get(tally, answer) + 1);
		});

		// Get the count of votes of the answer with the most vote
		let highestVoteCount = Array.from(tally).reduce((s, v) => Math.max(s, v[1]), 0);

		// Get the answers that have this count of vote
		// (there might be multiple answers in case of ties)
		let winningAnswers: number[] = range(0, answerCount).filter(a => get(tally, a) == highestVoteCount);

		// Every alive player that have not answered one of these loses one health
		let playersDamaged = this.getAlivePlayers().filter(p => !playerAnswers.has(p) || winningAnswers.indexOf(get(playerAnswers, p)) == -1);

		for (let player of playersDamaged) {
			this.state.playerLifes.set(player, get(this.state.playerLifes, player) - 1);
		}

		this.state.resultBegin = new Date();
		this.state.resultDuration = this.SECONDS_SHOW_RESULTS;
		this.state.winningAnswers = winningAnswers;

		this.logger.info("question finish", {
			i: this.state.questions.length,
			winningAnswers: winningAnswers,
			damagedPlayers: playersDamaged.map(p => p.id)
		});

		// Show the results of the question
		this.broadcastPacket({
			type: "question-results",
			// Give the answers of all the connectedPlayers
			playerAnswers: map_to_array(playerAnswers)
				.map(([player, answer]) => [player.id, answer] as [number, number]),
			// Give the new health value of all the damaged connectedPlayers
			playersDamaged: map_to_array(this.state.playerLifes)
				.filter(([player, life]) => playersDamaged.indexOf(player) != -1)
				.map(([player, life]) => [player.id, life] as [number, number]),
			resultBeginTimestamp: this.state.resultBegin.getTime(),
			resultDuration: this.state.resultDuration,
            winningAnswers: winningAnswers
		});

		await delay(this.SECONDS_SHOW_RESULTS);

		this.onResultsTimerFinish();
	}

	async onResultsTimerFinish() {
		// Check if the game is over (less than 2 connectedPlayers left)
		let alivePlayers = this.getAlivePlayers();
		if (alivePlayers.length < 3) {

			// Game is over!
			this.state = {
				type: GameStateType.RESULTS,
				winners: alivePlayers,
				begin: new Date(),
				duration: this.SECONDS_RESULTS_GAME
			};

			this.logger.info("game over", {winnerIds: alivePlayers.map(p => p.id)});

			this.broadcastPacket({
				type: "game-finish",
				winners: alivePlayers.map(p => p.id)
			});

			this.finishGame();
			return;
		}

		this.startQuestion();
	}

	getCurrentQuestion(): Question {
		if (this.state.type != GameStateType.QUESTION) {
			throw new Error("getCurrentQuestion called while not in-game");
		}

		return this.state.questions[this.state.questions.length - 1];
	}

	getAlivePlayers(): Player[] {
		if (this.state.type != GameStateType.QUESTION) {
			throw new Error("getAlivePlayers called when game in state " + this.state.type);
		}

		return Array.from(this.state.playerLifes).filter(([p, l]) => l > 0).map(([p, l]) => p);
	}

	toRetransmittedGame(destPlayer: Player): GameRetransmission {
		return {
			players: this.players.map(p => ({id: p.id, name: p.name})),
			state: this.state.type == GameStateType.WAITING ? {
				type: GameStateType.WAITING,
				maxPlayers: Game.MAX_PLAYERS
			} : this.state.type == GameStateType.QUESTION ? {
				type: GameStateType.QUESTION,
				questions: this.state.questions,
				playerLifes: map_to_array(this.state.playerLifes).map(([p, a]) => [p.id, a] as [number, number]),
				playerAnswers: this.state.resultBegin != null
					? (map_to_array(this.getCurrentQuestion().playerAnswers).map(([p, a]) => [p.id, a] as [number, number]))
					: (map_to_array(this.getCurrentQuestion().playerAnswers).map(([p, a]) => (destPlayer.id == p.id ? [p.id, a] : [p.id, -1]) as [number, number])),
				questionBegin: this.state.questionBegin.getTime(),
				questionDuration: this.state.questionDuration,
				resultBegin: this.state.resultBegin ? this.state.resultBegin.getTime() : null,
				resultDuration: this.state.resultDuration,
				winningAnswers: this.state.winningAnswers
			} : this.state.type == GameStateType.TIMER_BEFORE_BEGIN ? {
				type: GameStateType.TIMER_BEFORE_BEGIN,
				begin: this.state.begin.getTime(),
				duration: this.state.duration
			} : {
				type: GameStateType.RESULTS,
				winners: this.state.winners.map(p => p.id)
			}
		};
	}
}

type GameState = WaitingGameState | TimerBeforeBeginGameState | QuestionGameState | ResultsGameState;

export interface WaitingGameState {
	type: GameStateType.WAITING
}

export interface TimerBeforeBeginGameState {
	type: GameStateType.TIMER_BEFORE_BEGIN,
	begin: Date,
	duration: number
}

export interface QuestionGameState {
	type: GameStateType.QUESTION,
	questions: Question[],
	playerLifes: Map<Player, number>
	questionBegin: Date,
	questionDuration: number,
	resultBegin: Date | null,
	resultDuration: number | null,
	winningAnswers: number[] | null
}

export interface ResultsGameState {
	type: GameStateType.RESULTS,
	winners: Player[],
	begin: Date,
	duration: number
}

export enum GameStateType {
	WAITING = "waiting",
	TIMER_BEFORE_BEGIN = "timer-before-begin",
	QUESTION = "question",
	RESULTS = "results"
}
