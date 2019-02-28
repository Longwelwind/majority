import {observable} from "mobx";
import {GameRetransmission} from "../../commons/server-packets";
import {get} from "../../utils/map";

export default class Game {
	@observable players: Player[];
	@observable gameState: GameState;

	constructor(players: Player[], gameState: GameState) {
		this.players = players;
		this.gameState = gameState;
	}

	getPlayerById(id: number): Player {
		let i = this.players.map(p => p.id).indexOf(id);
		if (i == -1) {
			throw new Error();
		}

		return this.players[i];
	}

	static fromRetransmittedGame(game: GameRetransmission): Game {
		let state: GameState;
		if (game.state.type == "waiting") {
			state = new WaitingGameState(game.state.maxPlayers);
		} else if (game.state.type == "timer-before-begin") {
			state = new TimerBeforeBeginGameState(new Date(game.state.begin), game.state.duration);
		} else if (game.state.type == "question") {
			let questionState = new QuestionGameState(
				game.state.questions,
				new Map<number, number>([...game.state.playerAnswers]),
				new Map<number, number>([...game.state.playerLifes])
			);

			questionState.questionBegin = game.state.questionBegin ? new Date(game.state.questionBegin) : null;
			questionState.questionDuration = game.state.questionDuration;
			questionState.resultBegin = game.state.resultBegin ? new Date(game.state.resultBegin) : null;
			questionState.resultDuration = game.state.resultDuration;
			questionState.winningAnswers = game.state.winningAnswers;

			state = questionState
		} else if (game.state.type == "results") {
			state = new GameFinishState(
				game.state.winners
			);
		} else {
			throw new Error("Unknown game.state.type");
		}

		return new Game(game.players, state);
	}

	isWinner(player: Player): boolean {
		if (!(this.gameState instanceof GameFinishState)) {
			return false;
		}

		return this.gameState.winningPlayers.indexOf(player.id) != -1;
	}

	getPlayerLife(player: Player): number {
		if (!(this.gameState instanceof QuestionGameState)) {
			return -1;
		}

		return get(this.gameState.playerLifes, player.id);
	}

	isPlayerDead(player: Player): boolean {
		return this.getPlayerLife(player) == 0;
	}
}

export interface Player {
	id: number,
	name: string
}

export class GameState {

}

export class WaitingGameState extends GameState {
	maxPlayers: number;

	constructor(maxPlayers: number) {
		super();
		this.maxPlayers = maxPlayers;
	}
}

export class TimerBeforeBeginGameState extends GameState {
	begin: Date;
	duration: number;

	constructor(begin: Date, duration: number) {
		super();
		this.begin = begin;
		this.duration = duration;
	}
}

export class QuestionGameState extends GameState {
	@observable questions: Question[];

	/*
	 * Contains for each player_id, the answer of this player.
	 * When the question is being answered, will only contain -1 for connectedPlayers other than the user.
	 * Once the question is finished, will be filled with the real answers of the connectedPlayers.
	 */
	@observable playerAnswers: Map<number, number>;
	@observable playerLifes: Map<number, number>;
	@observable questionBegin: Date | null = null;
	@observable questionDuration: number | null = null;

	@observable resultBegin: Date | null = null;
	@observable resultDuration: number | null = null;
	@observable winningAnswers: number[] | null = null;

	constructor(questions: Question[], playerAnswers: Map<number, number>, playerLifes: Map<number, number>) {
		super();
		this.questions = questions;
		this.playerAnswers = playerAnswers;
		this.playerLifes = playerLifes;
	}
}

export class GameFinishState extends GameState {
	winningPlayers: number[];

	constructor(winningPlayers: number[]) {
		super();
		this.winningPlayers = winningPlayers;
	}
}

export interface Question {
	text: string,
	answers: string[]
}
