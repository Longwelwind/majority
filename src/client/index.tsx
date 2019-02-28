import * as ReactDOM from "react-dom";
import App from "./App";
import GameClient from "./store/GameClient";
import * as React from "react";
import "../../style/index.less";
import "semantic-ui-less/semantic.less";

const address = window.location.hostname == "localhost" ? "ws://localhost:3000" : "wss://" + window.location.hostname;
const ws = new WebSocket(address);
const gameClient = new GameClient(ws);
gameClient.onAuthentication = (player_id, name, token) => {
	localStorage.setItem("player_id", player_id.toString());
	localStorage.setItem("token", token);
};
gameClient.onConnect = () => {
	let idRaw = localStorage.getItem("player_id");
	let id = idRaw ? parseInt(idRaw) : null;
	let token = localStorage.getItem("token");

	if (id && token) {
		// We try to authenticate him
		gameClient.authenticate(id, name, token);
	}
};

// For debugging purpose
declare global {
	interface Window { gameClient: GameClient }
}
window.gameClient = gameClient;

ReactDOM.render(<App gameClient={gameClient} />, document.getElementById("react-mount-point"));
