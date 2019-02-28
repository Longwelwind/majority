import Player from "./Player";

export default interface Question {
	text: string,
	answers: string[],
	playerAnswers: Map<Player, number>
}