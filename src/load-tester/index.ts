/// <reference path="../types/moniker.d.ts" />

import * as program from "commander";
import {range} from "../utils/range";
import {delay} from "../utils/delay";
import GameClient from "../client/store/GameClient";
import {w3cwebsocket} from "websocket";
import {ServerPacket} from "../commons/server-packets";
import * as Moniker from "moniker";
import chalk from "chalk";
import {GameFinishState, QuestionGameState, WaitingGameState} from "../client/store/Game";

/**
 * Definition of the CLI command
 */
program
	.description("Load test a game server")
	.option("-s --server []", "Address to the game server", "localhost:3000")
	.option("-b --begin-player-count []", "", parseInt, 15)
	.option("-c --chance-new-player []", "", parseFloat, 0.8)
	.option("-q --chance-player-quit []", "", parseFloat, 0.01)
	.option("-d --chance-disconnect []", "", parseFloat, 0.15)
	.option("-r --chance-reconnect []", "", parseFloat, 0.2)
	.option("-m --max-player []", "", parseInt, 15)
	.option("-n -chance-not-answer []", "", parseFloat, 0.05)
	.parse(process.argv);

/**
 * Functions used for the bots
 */
interface Bot {
	id: number | null,
	name: string,
	token: string | null,
	gameClient: GameClient | null,
}

let bots: Bot[] = [];

function connectBot(bot: Bot) {
	if (bot.gameClient != null) {
		throw new Error();
	}

	// In Node, we don't have access to the native WebSocket API that the browser
	// offers. We emulate this by using the class w3cwebsocket of the library "websocket"
	// The "as" are there to trick the Typescript compiler into accepting the emulation.
	let ws = new w3cwebsocket("ws://" + program.server);
	bot.gameClient = new GameClient(ws as any as WebSocket);

	bot.gameClient.websocket.onopen = event => {
		if (bot.gameClient == null) {
			return;
		}

		bot.gameClient.onWebsocketOpen();

		bot.gameClient.websocket.onmessage = async event => {
			if (bot.gameClient == null) return;
			let packet: ServerPacket = JSON.parse(event.data);
			bot.gameClient.onMessage(event);

			if (packet.type == "authenticate") {
				// A new bot is created
				bot.id = packet.id;
				bot.name = packet.name;
				bot.token = packet.token;
			} else if (packet.type == "new-question") {
				// Small chance of not answering the question at all
				if (Math.random() < program.chanceNotAnswer) {
					return;
				}

				await delay(Math.floor(Math.random() * packet.duration));
				if (bot.gameClient == null) return;

				bot.gameClient.chooseAnswer(Math.floor(Math.random() * packet.question.answers.length));
			} else if (packet.type == "game-finish") {
				await delay(Math.random() * 30);
				bot.gameClient.joinGame();
			}
		};

		bot.gameClient.websocket.onclose = () => {
			if (bot.gameClient == null) return;

			bot.gameClient.onWebsocketClose();
			bot.gameClient = null
		};

		if (bot.id && bot.token) {
			bot.gameClient.authenticate(bot.id, bot.name, bot.token);
		} else {
			bot.gameClient.newPlayer(bot.name);
		}
	};
}

function disconnectBot(bot: Bot) {
	if (bot.gameClient == null) {
		throw new Error();
	}

	bot.gameClient.websocket.close();
}

function createBot() {
	let bot: Bot = {
		id: null,
		token: null,
		name: Moniker.choose(),
		gameClient: null
	};

	bots.push(bot);

	connectBot(bot);
}

/**
 * Load testing
 */
async function newBotLoop() {
	while (true) {
		await delay(1);
		if (bots.length < program.maxPlayer) {
			if (Math.random() < program.chanceNewPlayer) {
				createBot();
			}
		}
	}
}

async function disconnectLoop() {
	while (true) {
		await delay(1);
		let connectedBot = bots.find(b => b.gameClient != null);
		if (connectedBot) {
			if (Math.random() < program.chanceDisconnect) {
				disconnectBot(connectedBot);
			}
		}
	}

}

async function reconnectLoop() {
	while (true) {
		await delay(1);
		let disconnectedBot = bots.find(b => b.gameClient == null);
		if (disconnectedBot) {
			if (Math.random() < program.chanceReconnect) {
				connectBot(disconnectedBot);
			}
		}
	}
}

async function displayInfo() {
	while(true) {
		let before = Date.now();
		await delay(1);
		let after = Date.now();

		let time = (after - before) / 1000;

		if (time > 1.5) {
			console.log(`Took ${chalk.red(time.toFixed(2).toString())} seconds to process`);
		}

		let disconnectedBots = bots.filter(b => b.gameClient == null);

		let connectedBots = bots.filter(b => b.gameClient);
		let inGameBots = connectedBots.filter(b => b.gameClient && b.gameClient.currentGame != null);
		let botsInWaitingPhase = connectedBots.filter(
			b => b.gameClient && b.gameClient.currentGame && b.gameClient.currentGame.gameState instanceof WaitingGameState
		);
		let botsInQuestionPhase = connectedBots.filter(
			b => b.gameClient && b.gameClient.currentGame && b.gameClient.currentGame.gameState instanceof QuestionGameState
		);
		let botsInFinishPhase = connectedBots.filter(
			b => b.gameClient && b.gameClient.currentGame && b.gameClient.currentGame.gameState instanceof GameFinishState
		);

		console.log("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
		console.log(`Number of bots: ${chalk.yellow(bots.length.toString())}`);
		console.log(`  Disconnected bots: ${chalk.yellow(disconnectedBots.length.toString())}`);
		console.log(`  Connected bots: ${chalk.yellow(connectedBots.length.toString())}`);
		console.log(`    In-Game bots: ${chalk.yellow(inGameBots.length.toString())}`);
		console.log(`      In Waiting Phase: ${chalk.yellow(botsInWaitingPhase.length.toString())}`);
		console.log(`      In Question Phase: ${chalk.yellow(botsInQuestionPhase.length.toString())}`);
		console.log(`      In Finish Phase: ${chalk.yellow(botsInFinishPhase.length.toString())}`);
	}
}


range(0, program.beginPlayerCount).forEach(i => {
	createBot();
});

newBotLoop();
disconnectLoop();
reconnectLoop();
displayInfo();