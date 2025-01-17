import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs';
import type { Config } from '../types/config';
import type { Savegame } from '../types/savegame';
import { get } from 'svelte/store';
import { getTeamHeader, getFS25Dir } from './shared.sync';
import { config } from '../stores/config.store';
import { error } from '@tauri-apps/plugin-log';
import { dev } from '$app/environment';

export const baseDomain = dev && false ? "127.0.0.1:8787" : "farm-station-25.eweren.workers.dev";
export const protocol = dev && false ? "http" : "https";

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
    const players = await fetch(`${protocol}://${baseDomain}/_playerStatus`, { headers }).then(
      (r) => r.json() as Promise<Array<string>>,
    );

    if (Array.isArray(players)) {
      return players;
    }
    return [];
  } catch (e) {
    error(`Error fetching player status ${e}`);
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
    await fetch(`${protocol}://${baseDomain}/_playerStatus`, {
      headers,
      method: "POST",
      body: JSON.stringify({ playing, name })

    });
  } catch (e) {
    error(`Error changing play state ${e}`);
  }
}

/**
 * Saves the config and sets the `configStore` as well.
 */
export async function saveConfig(_config: Config) {
  invoke("save_config", { config: JSON.stringify(_config) })
  config.set(_config);
}

/**
 * Updates the name of a savegame only locally. To update the name remotely as well, the user has to sync again.
 */
export async function updateSavegameName(savegameName: string, savegameId: string): Promise<boolean> {
  const dir = await getFS25Dir();
  if (dir == null) {
    return false;
  }

  const updatedCareerSavegameXml = await readFile(
    `${dir}/${savegameId}/careerSavegame.xml`,
    {
      baseDir: BaseDirectory.Document,
    },
  )
    .then((file) => new TextDecoder().decode(file))
    .then((fileContent) => fileContent.replace(/\<savegameName\>(.*)\<\/savegameName\>/, `<savegameName>${savegameName}</savegameName>`))
    .catch((e) => {
      error(e);
      return null;
    });

  if (updatedCareerSavegameXml == null) {
    return false;
  }

  try {
    await writeFile(
      `${dir}/${savegameId}/careerSavegame.xml`,
      new TextEncoder().encode(updatedCareerSavegameXml),
      {
        baseDir: BaseDirectory.Document,
      },
    );
    return true;
  } catch (e) {
    error(`${e}`);
    return false;
  }
}


/**
 * Loads the config file from the config directory into the config storage
 */
export async function loadConfig(localSavegames: Array<Savegame>): Promise<Config> {
  const _config: Config = await invoke("load_config", { gameDataDirectory: await getFS25Dir(true) ?? "" });

  for (const key in _config.savegameMapping) {
    if (!localSavegames.find((sg) => sg.id === key)) {
      delete _config.savegameMapping[key];
    }
  }
  _config.savegameMapping = _config.savegameMapping ?? {};

  config.set(_config);
  return _config;
}

/**
 * Starts a watcher that checks if FS25 is running every 3 seconds.
 */
export async function watchFarmingSimulator() {
  try {
    await invoke("watch_farming_simulator_25");
  } catch (e) {
    error(`Error watching FS25: ${e}`);
  }
}

/**
 * Triggers the backend command to start the game
 */
export async function startGame() {
  try {
    await invoke("start_farming_simulator_25");
  } catch (e) {
    error(`Error starting game: ${e}`);
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
    `${protocol}://${baseDomain}`,
    {
      body: formData,
      method: "POST",
    },
  ).then(async (response) => response.json()) as { status: string, reason?: string, inviteCode?: string };

  return res;
}



