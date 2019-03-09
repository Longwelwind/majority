import * as React from "react";
import {Component} from "react";
import GameClient, {ConnectionState} from "./store/GameClient";
import {observer} from "mobx-react";
import {Grid} from "semantic-ui-react";
import GameComponent from "./components/GameComponent";
import JoinGameComponent from "./components/JoinGameComponent";

interface AppProps {
	gameClient: GameClient;
}

@observer
export default class App extends Component<AppProps> {
	getConnectionState(): ConnectionState {
		return this.props.gameClient.connectionState;
	}

	render() {
		return (
			<div style={{height: "100%", display: "flex", flexDirection: "column"}}>
				<Grid centered style={{paddingTop: "50px"}}>
					{this.getConnectionState() == ConnectionState.CONNECTING ? (
						"Connecting"
					) : this.getConnectionState() == ConnectionState.AUTHENTICATING ? (
						"Authenticating"
					) : this.getConnectionState() == ConnectionState.CONNECTED ? (
						this.props.gameClient.selfPlayer == null ? (
							<JoinGameComponent gameClient={this.props.gameClient}/>
						) : this.props.gameClient.currentGame != null ? (
							<GameComponent gameClient={this.props.gameClient} game={this.props.gameClient.currentGame}/>
						) : (
							"Joining a game"
						)
					) : (this.getConnectionState() == ConnectionState.DISCONNECTED || this.getConnectionState() == ConnectionState.ERROR_CONNECTING) ? (
						"Error connecting to server. Please refresh the page to reconnect"
					) : ""}
				</Grid>
				<div style={{flexGrow: 1}}/>
				<div className="footer">
					<a target="_blank" href="https://github.com/Longwelwind/majority">Open-source</a> reimplementation
					by <a target="_blank" href="https://longwelwind.net/">Longwelwind</a> of the game
					of the same name from <a target="_blank" href="https://motion-twin.com/">
					Motion Twin</a>.
				</div>
			</div>
		);
	}
}
