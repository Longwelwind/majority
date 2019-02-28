import GameClient from "../store/GameClient";
import Game, {
	GameFinishState,
	Player,
	Question,
	QuestionGameState,
	TimerBeforeBeginGameState,
	WaitingGameState
} from "../store/Game";
import * as React from "react";
import {Component} from "react";
import {observer} from "mobx-react";
import {get} from "../../utils/map";
import ObservableTime from "../../utils/ObservableTime";
import {Button, Grid, Label, Segment} from "semantic-ui-react";
import PlayerComponent from "./PlayerComponent";
import answerColors, {AnswerColor} from "../store/answerColors";
import addPopupConditionally from "../../utils/addPopupConditionally";

interface GameComponentProps {
	gameClient: GameClient,
	game: Game
}

@observer
export default class GameComponent extends Component<GameComponentProps> {
	render() {
		return (
			<Grid.Column mobile={15} computer={12} widescreen={9}>
				<Grid>
					<Grid.Column mobile={16}>
						<Segment raised style={{minHeight: 150}}>
							{this.props.game.gameState instanceof QuestionGameState && this.props.game.gameState.questions.length > 0 && (
								<div className="ui ribbon label ">
									Question {this.getQuestionNumber()}
									{" "}-{" "}
									{Math.round(this.getTimeLeft())}s
								</div>
							)}
							<Grid centered verticalAlign="middle">
								{this.props.game.gameState instanceof WaitingGameState ? (
									<Grid.Row stretched>
										<Grid.Column mobile={16} style={{textAlign: "center"}}>
											<div>
												Waiting for <strong>{this.getCountPlayersToJoin()}</strong> players to begin the game...
											</div>
										</Grid.Column>
									</Grid.Row>
								) : this.props.game.gameState instanceof TimerBeforeBeginGameState ? (
									<Grid.Row stretched>
										<Grid.Column mobile={16} style={{textAlign: "center"}}>
											<div>
												Enough players have joined!
											</div>
											<div>
												Match will begin in {Math.round(this.getSecondsLeftBeforeBegin())}...
											</div>
										</Grid.Column>
									</Grid.Row>
								) : this.props.game.gameState instanceof QuestionGameState ? (
									this.props.game.gameState.questions.length > 0 ?
										<>
											<Grid.Column mobile={12} style={{textAlign: "center"}}>
												{this.getCurrentQuestion().text}
											</Grid.Column>
											<Grid.Column mobile={16} computer={14}>
												<Grid centered>
												{this.getCurrentQuestion().answers.map((a, i) => (
													<Grid.Column mobile={16} tablet={5} computer={5} key={i}>
														{!this.isResultPhase() ? (
															addPopupConditionally(
																this.isSelfPlayerDead(),
																"You are dead",
																<Button
																	fluid
																	color={this.getColorOfAnswer(i)}
																	onClick={this.chooseAnswer.bind(this, i)}
																	disabled={this.hasSelfPlayerAnswered() || this.isSelfPlayerDead()}
																	basic={(this.hasSelfPlayerAnswered() && !this.isAnswerOfPlayer(i)) || this.isSelfPlayerDead()}
																	className="answer-button"
																>
																	{a}
																</Button>
															)
														) : (
															<Button
																fluid
																disabled
																labelPosition="right"
																as="div"
																className={"answer-button " + (this.isWinningAnswer(i) ? "win-answer" : "")}
															>
																<Button
																	fluid
																	color={this.getColorOfAnswer(i)}
																	basic={!this.isAnswerOfPlayer(i)}
																>
																	{a}
																</Button>
																<Label as="div">
																	{this.getCountAnswer(i)}
																</Label>
															</Button>
														)}
													</Grid.Column>
												))}
												</Grid>
											</Grid.Column>
										</> : ""
								) : this.props.game.gameState instanceof GameFinishState ? (
									<>
										<Grid.Column mobile={16} style={{textAlign: "center"}}>
											{this.props.game.gameState.winningPlayers.length == 0 ? (
												<>All players are dead, there are no winners.</>
											) : this.props.game.gameState.winningPlayers.length == 1 ? (
												<>The winner is {this.getConcatenatedWinnerNames()}, congratulations!</>
											) : (
												<>The winners are {this.getConcatenatedWinnerNames()}, congratulations!</>
											)}
										</Grid.Column>
										<Grid.Column mobile={16} computer={4}>
											<Button
												primary
												fluid
												onClick={this.joinNewGame.bind(this)}
											>
												Join a new game
											</Button>
										</Grid.Column>
									</>
								) : ""}
							</Grid>
						</Segment>
					</Grid.Column>
					<Grid.Column mobile={16}>
						<Grid className="small-gutter">
							{this.getOrderedPlayers().map(p => (
								<Grid.Column mobile={8} tablet={4} computer={3} largeScreen={2} widescreen={2} key={p.id}>
									<PlayerComponent
										gameClient={this.props.gameClient}
										game={this.props.game}
										player={p}
									/>
								</Grid.Column>
							))}
						</Grid>
					</Grid.Column>
				</Grid>
			</Grid.Column>
		);
	}

	getCurrentQuestion(): Question {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error("getCurrentQuestion called when game in state" + this.props.game.gameState.constructor.name);
		}

		if (this.props.game.gameState.questions.length == 0) {
			throw new Error("getCurrentQuestion called with questions.length == 0");
		}

		return this.props.game.gameState.questions[this.props.game.gameState.questions.length - 1];
	}

	chooseAnswer(answer: number) {
		this.props.gameClient.chooseAnswer(answer);
	}

	getTimeLeft(): number {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			return 0;
		}

		let gameState = this.props.game.gameState;

		let timeLeft;
		if (gameState.resultBegin != null && gameState.resultDuration != null) {
			timeLeft = (gameState.resultDuration*1000 - (ObservableTime.now - gameState.resultBegin.getTime())) / 1000;
		} else if (gameState.questionBegin != null && gameState.questionDuration != null) {
			timeLeft = (gameState.questionDuration*1000 - (ObservableTime.now - gameState.questionBegin.getTime())) / 1000;
		} else {
			return 0;
		}

		return Math.max(timeLeft, 0);
	}

	getAnswerPlayer(p: Player): number | null {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error();
		}

		if (this.props.game.gameState.playerAnswers.has(p.id)) {
			return get(this.props.game.gameState.playerAnswers, p.id);
		} else {
			return null;
		}
	}

	hasPlayerAnswered(p: Player): boolean {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error();
		}

		const playerAnswer = this.getAnswerPlayer(p);
		return playerAnswer != null;
	}

	hasSelfPlayerAnswered(): boolean {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error();
		}

		if (this.props.gameClient.selfPlayer == null) {
			throw new Error();
		}

		return this.hasPlayerAnswered(this.props.gameClient.selfPlayer);
	}

	isAnswerOfPlayer(a: number): boolean {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error();
		}

		if (this.props.gameClient.selfPlayer == null) {
			throw new Error();
		}

		return this.props.game.gameState.playerAnswers.get(this.props.gameClient.selfPlayer.id) == a;
	}

	isResultPhase(): boolean {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error("isResultPhase is called but game is in state " + this.props.game.gameState.constructor.name);
		}

		return this.props.game.gameState.resultBegin != null;
	}

	getCountAnswer(answer: number): number {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			throw new Error("isResultPhase is called but game is in state " + this.props.game.gameState.constructor.name);
		}

		return Array.from(this.props.game.gameState.playerAnswers.values()).filter(v => v == answer).length;
	}

	isWinningAnswer(answer: number): boolean {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			return false;
		}

		return this.props.game.gameState.winningAnswers != null
			&& this.props.game.gameState.winningAnswers.indexOf(answer) != -1;
	}

	joinNewGame() {
		this.props.gameClient.joinGame();
	}

	isSelfPlayerDead(): boolean {
		if (this.props.gameClient.selfPlayer == null) {
			throw new Error();
		}

		return this.props.game.isPlayerDead(this.props.gameClient.selfPlayer);
	}

	getColorOfAnswer(i: number): AnswerColor {
		if (i < 0 || answerColors.length <= i) {
			throw new Error();
		}

		return answerColors[i];
	}

	getConcatenatedWinnerNames(): string {
		if (!(this.props.game.gameState instanceof GameFinishState)) {
			throw new Error();
		}

		const winnerNames = this.props.game.gameState.winningPlayers.map(id => this.props.game.getPlayerById(id).name);

		return winnerNames.join(" and ");
	}

	getQuestionNumber(): number {
		if (!(this.props.game.gameState instanceof QuestionGameState)) {
			return 0;
		}

		return this.props.game.gameState.questions.length;
	}

	getCountPlayersToJoin(): number {
		if (!(this.props.game.gameState instanceof WaitingGameState)) {
			throw new Error();
		}

		return this.props.game.gameState.maxPlayers - this.props.game.players.length;
	}

	getOrderedPlayers(): Player[] {
		// ".slice()" to create a copy of the array, instead of modifying it in place
		return this.props.game.players.slice().sort((p1, p2) =>
			this.props.gameClient.isSelfPlayer(p1) ? -1 : this.props.gameClient.isSelfPlayer(p2) ? 1 : 0
		);
	}

	getSecondsLeftBeforeBegin(): number {
		if (!(this.props.game.gameState instanceof TimerBeforeBeginGameState)) {
			throw new Error();
		}
		let gameState = this.props.game.gameState;
		return this.props.game.gameState.duration - (ObservableTime.now - gameState.begin.getTime()) / 1000;
	}
}
