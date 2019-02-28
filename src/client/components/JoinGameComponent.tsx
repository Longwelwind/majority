import {observer} from "mobx-react";
import {Component} from "react";
import {Button, Grid, Input, Segment} from "semantic-ui-react";
import * as React from "react";
import {observable} from "mobx";
import GameClient from "../store/GameClient";


interface JoinGameComponentProps {
	gameClient: GameClient
}

@observer
export default class JoinGameComponent extends Component<JoinGameComponentProps> {
	@observable chosenName: string = "";

	render() {
		return (
			<Grid.Column mobile={15} tablet={10} computer={4} largeScreen={3}>
				<Grid centered>
					<Grid.Column mobile={16}>
						<Segment raised>
							<h1>Majority</h1>
							<h4>Rules:</h4>
							<ul>
								<li>
									You will be presented with questions, each with 3 random answers. The correct answer to
									each questions will not be among the 3 answers.
								</li>
								<li>
									Choose the answer that will be the most picked by the other players.
								</li>
								<li>
									Players in the minority lose one health point. You have 3 health points, lose them
									all and you will be out of the game.
								</li>
								<li>
									The winners are the last 2 remaining players.
								</li>
							</ul>
						</Segment>
					</Grid.Column>
					<Grid.Column mobile={12}>
						<Input
							fluid
							icon="user"
							placeholder="Nickname"
							value={this.chosenName}
							onChange={e => this.chosenName = e.target.value}
						/>
					</Grid.Column>
					<Grid.Column mobile={12}>
						<Button
							primary
							fluid
							onClick={this.joinGame.bind(this)}
						>
							Join a game
						</Button>
					</Grid.Column>
				</Grid>
			</Grid.Column>
		);
	}

	joinGame() {
		this.props.gameClient.newPlayer(this.chosenName);
	}
}
