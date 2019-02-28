export type ClientPacket = PingPacket | AuthenticationPacket | JoinGamePacket | LeaveGamePacket | AnswerQuestionPacket;

export interface PingPacket {
	type: "ping"
}

export interface AuthenticationPacket {
	type: "authentication",
	player_id: number | null,
	token: string | null,
	name: string | null
}

export interface LeaveGamePacket {
	type: "leave-game"
}

export interface JoinGamePacket {
	type: "join-game"
}

export interface AnswerQuestionPacket {
	type: "answer-question",
	answer: number
}
