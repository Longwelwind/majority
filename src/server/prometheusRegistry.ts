import {collectDefaultMetrics, Gauge, register, Registry} from "prom-client";
import GlobalServer from "./GlobalServer";
import {GameStateType} from "./Game";


export default function createPrometheusRegister(globalServer: GlobalServer): {prometheusRegistry: Registry, onRequest: () => void} {
    const gameStates = [GameStateType.WAITING, GameStateType.TIMER_BEFORE_BEGIN, GameStateType.QUESTION, GameStateType.RESULTS];

    const connectedPlayers = new Gauge({name: "connected_players_total", help: "Connected players"});
    const connectedClients = new Gauge({name: "connected_clients_total", help: "Connected clients"});
    const currentGamesTotal = new Gauge({
        name: "current_games_total",
        help: "Current games",
        labelNames: ["state"]
    });

    collectDefaultMetrics();

    // This function will be called when a call to /metrics is done.
    // This allows us to refresh the metrics in a functional manner.
    const onRequest = () => {
        connectedPlayers.set(globalServer.connectedPlayers.length);
        connectedClients.set(globalServer.connectedClients.length);
        gameStates.forEach(s => {
            const count = globalServer.ongoingGames.filter(g => g.state.type == s).length;
            currentGamesTotal.labels(s).set(count);
        });
    };

    return {prometheusRegistry: register, onRequest};
}
