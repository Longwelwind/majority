import GameClient from "../store/GameClient";
import Game, {GameFinishState, Player, QuestionGameState} from "../store/Game";
import {Component} from "react";
import * as React from "react";
import {Grid, Icon, Segment} from "semantic-ui-react";
import {range} from "../../utils/range";
import {get} from "../../utils/map";
import answerColors, {AnswerColor} from "../store/answerColors";

interface PlayerComponentProps {
	gameClient: GameClient,
	game: Game,
	player: Player
}

export default class PlayerComponent extends Component<PlayerComponentProps> {
	render() {
		return (
			<Segment
				raised
				className={
					"player-segment "
					+ (this.shouldFadePlayerSegment(this.props.player) ? "dead-player-segment" : "")
					+ (this.getPlayerSegmentColorClass(this.props.player))
				}
				size="small"
			>
				<div className="player-name">
					{this.props.gameClient.isSelfPlayer(this.props.player) && (
						<Icon name="star" color="yellow" size="small"/>
					)}
					{this.props.game.isWinner(this.props.player) && (
						<Icon name="winner" color="yellow" size="small"/>
					)}
					{this.props.player.name}
				</div>
				<div className={this.props.game.gameState instanceof QuestionGameState ? "" : "visibility-hidden"}>
					{range(0, 3).map(i => (
						<Icon name="heart" color={i < this.props.game.getPlayerLife(this.props.player) ? "red" : "grey"} size="small" key={i}/>
					))}
				</div>
			</Segment>
		);
	}

	getPlayerSegmentColorClass(player: Player): string {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			return "";
		}

		if (!this.props.game.gameState.playerAnswers.has(player.id)) {
			return "";
		}

		let playerAnswer = get(this.props.game.gameState.playerAnswers, player.id);

		if (this.props.game.gameState.resultBegin == null) {
			return "outline-yellow";
		} else {
			return "outline-" + answerColors[playerAnswer];
		}
	}

	shouldFadePlayerSegment(player: Player): boolean {
		if (this.props.game.gameState instanceof QuestionGameState) {
			return this.props.game.isPlayerDead(player);
		} else if (this.props.game.gameState instanceof GameFinishState) {
			return !this.props.game.isWinner(player);
		}

		return false;
	}
}
