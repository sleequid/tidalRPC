import { Client, Presence } from "discord-rpc";
import { app } from "electron";

import Song from "@classes/song.class";
import { store } from "@util/config";
import { formatTime } from "@util/formatTime";

import { clientID, logger } from "../config";

let rpcClient: discordClient;

class discordClient {
	clientId: string;
	private client: Client;
	private ready: boolean = false;
	actualPresence!: Presence;

	constructor(clientID: string) {
		rpcClient = this;
		this.clientId = clientID;
		this.client = new Client({
			transport: "ipc"
		});

		this.client.on("ready", () => {
			this.ready = true;
			this.setActivity();
		});

		this.client.on(
			// @ts-ignore
			"disconnected",
			() => {
				this.client.destroy();
				rpcClient = undefined!;
			}
		);

		this.client
			.login({ clientId: this.clientId })
			.catch(err => console.error(err));
	}

	setActivity(data?: Presence) {
		data = data ? data : this.actualPresence;
		if (!this.ready) return;

		this.client.setActivity(data).catch(() => this.client.destroy());
	}

	clearActivity() {
		if (!this.ready) return;

		this.client.clearActivity().catch(() => this.client.destroy());
	}

	destroyClient() {
		if (!this.ready) return;

		this.client.destroy();
	}
}

export const setActivity = (data: Song) => {
		if (!data?.startTime) return clearActivity();

		const presenceData: Presence = {
			largeImageKey: data.quality === "HI_RES" ? "logo_mqa" : "logo",
			largeImageText:
				data.quality === "HI_RES"
					? `Tidal [MQA] ${
							store.get("showAppName")
								? `${String.fromCharCode(8226)} tidalRPC ${app.getVersion()}`
								: ""
					  }`
					: `Tidal ${
							store.get("showAppName")
								? `${String.fromCharCode(8226)} tidalRPC ${app.getVersion()}`
								: ""
					  }`
		};

		if (!data.duration) presenceData.startTimestamp = data.startTime;
		else
			presenceData.endTimestamp =
				data.startTime + data.duration + data.pausedTime;

		presenceData.state = data.artist;
		presenceData.details =
			data.title +
			`${
				data.album && store.get("showAlbum")
					? ` • ${data.album.name} (${data.album.year})`
					: ""
			}`;
		presenceData.smallImageKey = data.paused ? "pause" : "play";
		presenceData.smallImageText = data.paused ? "Paused" : "Playing";

		if (data.buttons && data.buttons.length !== 0 && store.get("showButtons"))
			presenceData.buttons = data.buttons;

		if (data.paused && presenceData.endTimestamp)
			delete presenceData.endTimestamp;

		if (data.duration && presenceData.startTimestamp)
			delete presenceData.startTimestamp;

		logger.extend("discordManager").extend("setActivity")(
			`Setting activity with ${data.artist} - ${
				data.title
			}. Duration: ${formatTime(data.duration)}`
		);

		if (!rpcClient) {
			rpcClient = new discordClient(clientID);
			rpcClient.actualPresence = presenceData;
		} else rpcClient.setActivity(presenceData);
	},
	clearActivity = () => {
		if (!rpcClient) return;
		rpcClient.clearActivity();
	},
	destroyClient = () => {
		if (!rpcClient) return;
		rpcClient.destroyClient();
	};
