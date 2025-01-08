import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, readFile, exists, writeFile } from '@tauri-apps/plugin-fs';
import type { Config } from '../types/config';
import type { Savegame } from '../types/savegame';
import { get } from 'svelte/store';
import { getTeamHeader, getFS25Dir } from './shared.sync';
import { config } from '../stores/config.store';

export const r2Domain = "r2.eweren.workers.dev"
export const protocol = "https"

export const documentsDefaultDir = "My Games\\FarmingSimulator2025";

/**
 * Fetches the potentially other players that are playing from server.
 * @returns an array of player names
 */
export async function getPlayerStatus() {
  try {
    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    const players = await fetch(`${protocol}://${r2Domain}/_playerStatus`, { headers }).then(
      (r) => r.json() as Promise<Array<string>>,
    );

    return players;
  } catch (e) {
    console.log(e);
  }
}

/**
 * Sets the current player as either playing or not playing on the server.
 * @param playing wether the player is playing or not.
 */
export async function changePlayState(playing: boolean) {
  try {
    const headers = getTeamHeader();
    let name = get(config).name
    if (!headers || name == null) {
      return;
    }

    headers.append("content-type", "application/json")
    await fetch(`${protocol}://${r2Domain}/_playerStatus`, {
      headers,
      method: "POST",
      body: JSON.stringify({ playing, name })

    });
  } catch (e) {
    console.log(e);
  }
}

/**
 * Saves the config and sets the `configStore` as well.
 */
export async function saveConfig(_config: Config) {
  try {
    await writeFile("config.json", new TextEncoder().encode(JSON.stringify(_config)), {
      baseDir: BaseDirectory.Config
    });
    config.set(_config);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Loads the config file from the config directory into the config storage
 */
export async function loadConfig(localSavegames: Array<Savegame>): Promise<Config> {
  try {
    if (!(await exists("config.json", { baseDir: BaseDirectory.Config }))) {
      const config: Config = {
        savegameMapping: {},
        gameDataDirectory: await getFS25Dir(true) ?? "",
      };

      await saveConfig(config);
      return config;
    }

    const file = await readFile("config.json", {
      baseDir: BaseDirectory.Config
    });
    const content = JSON.parse(new TextDecoder().decode(file)) as Config;

    for (const key in content.savegameMapping) {
      if (!localSavegames.find((sg) => sg.id === key)) {
        delete content.savegameMapping[key];
      }
    }
    content.savegameMapping = content.savegameMapping ?? {};

    config.set(content);
    return content;
  } catch (e) {
    console.error(e);
    const config: Config = {
      savegameMapping: {},
      gameDataDirectory: await getFS25Dir(true) ?? "",
    };

    await saveConfig(config);
    return config;
  }
}

/**
 * Starts a watcher that checks if FS25 is running every 3 seconds.
 */
export async function watchFarmingSimulator() {
  try {
    await invoke("watch_farming_simulator_25");
  } catch (e) {
    console.error(e);
  }
}

/**
 * Triggers the backend command to start the game
 */
export async function startGame() {
  try {
    await invoke("start_farming_simulator_25");
  } catch (e) {
    console.error(e);
  }
}

/**
 * Submits teamId and inviteCode (if present) to the server to either create or join a team
 * @param teamId the teamId to join
 * @param inviteCode the inviteCode for this team
 * @param isCreate whether this is a create command - is trying to join otherwise
 * @returns a status of `success` if the request was a success, a reason if it wasn't and the inviteCode if
 *          the team was created
 */
export async function createTeam(teamId: string, inviteCode: string, isCreate: boolean) {

  const formData = new FormData();
  formData.append("teamId", teamId);
  formData.append("inviteCode", inviteCode);
  if (isCreate) {
    formData.append("isCreate", "true");
  }
  const res = await fetch(
    `${protocol}://${r2Domain}`,
    {
      body: formData,
      method: "POST",
    },
  ).then(async (response) => response.json()) as { status: string, reason?: string, inviteCode?: string };

  return res;
}



