import {GameStateType} from "../server/Game";

export type ServerPacket = PongPacket | AuthenticatePacket | TimerBeforeBeginPacket | GameBeginPacket | JoinGamePacket
	| InformationStateGamePacket | NewPlayerPacket | NewQuestionPacket | PlayerAnswerPacket
	| QuestionResultsPacket | GameFinishPacket | RemovePlayerPacket;

// Sent when receiving a ping packet
interface PongPacket {
	type: "pong"
}

// Sent when the player successfully authenticated
interface AuthenticatePacket {
	type: "authenticate",
	id: number,
	token: string,
	name: string,
	game: GameRetransmission | null
}

export interface GameRetransmission {
	players: {id: number, name: string}[],
	state: GameStateRetransmission,
}

type GameStateRetransmission = WaitingGameStateRetransmission | TimerBeforeBeginRetransmission
	| QuestionGameStateRetransmission | ResultsGameStateRetransmission;

export interface WaitingGameStateRetransmission {
	type: "waiting",
	maxPlayers: number
}

export interface TimerBeforeBeginRetransmission {
	type: "timer-before-begin",
	begin: number,
	duration: number
}

export interface QuestionGameStateRetransmission {
	type: "question",
	questions: {text: string, answers: string[]}[],
	playerAnswers: [number, number][],
	playerLifes: [number, number][],
	questionBegin: number | null,
	questionDuration: number | null,
	resultBegin: number | null,
	resultDuration: number | null,
	winningAnswers: number[] | null
}

export interface ResultsGameStateRetransmission {
	type: "results",
	winners: number[]
}

// Sent when a player joins a game
interface JoinGamePacket {
	type: "join-game",
	players: {
		id: number,
		name: string
	}[],
	maxPlayers: number
}

// Sent when the player connects and was already in a game
interface InformationStateGamePacket {
	type: "information-state-game",
	players: {
		id: number,
		name: string
	}[],
	gameState: GameState
}

interface TimerBeforeBeginPacket {
	type: "timer-before-begin",
	begin: number,
	duration: number
}

// Sent when the game begins
interface GameBeginPacket {
	type: "game-begin",
	playerLifes: [number, number][]
}

type GameState = WaitingGameState | QuestionGameState;

interface WaitingGameState {
	type: GameStateType.WAITING
}

interface QuestionGameState {
	type: GameStateType.QUESTION
}

// Sent when a player is a in a game and a player joins the game
interface NewPlayerPacket {
	type: "new-player",
	player: {
		id: number,
		name: string
	}
}

// Sent when a new question starts in the game
interface NewQuestionPacket {
	type: "new-question",
	question: {
		text: string,
		answers: string[]
	},
	begin_timestamp: number,
	duration: number
}

// Sent when a player chose an answer
interface PlayerAnswerPacket {
	type: "player-answer",
	player_id: number,
	answer: number
}

// Sent when the phase where connectedPlayers can answer is finished
interface QuestionResultsPacket {
	type: "question-results",
	playerAnswers: [number, number][],
	playersDamaged: [number, number][],
	resultBeginTimestamp: number,
	resultDuration: number,
	winningAnswers: number[]
}

// Sent when the game is finished
interface GameFinishPacket {
	type: "game-finish",
	winners: number[]
}

interface RemovePlayerPacket {
	type: "remove-player",
	player_id: number
}
