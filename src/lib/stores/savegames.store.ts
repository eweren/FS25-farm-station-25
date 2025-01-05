import type { Config } from '../types/config';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { writable, derived } from 'svelte/store';
import { SvelteSet } from "svelte/reactivity";

export const localSavegames = writable<Savegame[]>([]);
export const remoteSavegames = writable<ListObjectResponse[]>([]);
export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});

export const savegamesWithRemote = derived([localSavegames, config, remoteSavegames], ([localSavegames, config, remoteSavegames]) => localSavegames.filter(
  (savegame) =>
    config.savegameMapping[savegame.id] != null &&
    remoteSavegames.some(
      (s) => s.key === config.savegameMapping[savegame.id],
    ),
));

export const localOnlySavegames = derived([localSavegames, config, remoteSavegames], ([localSavegames, config, remoteSavegames]) => localSavegames.filter(
  (savegame) =>
    config.savegameMapping[savegame.id] == null ||
    !remoteSavegames.some(
      (s) => s.key === config.savegameMapping[savegame.id],
    ),
));

export const remoteOnlySavegames = derived([config, remoteSavegames], ([config, remoteSavegames]) => remoteSavegames.filter(
  (savegame) => !Object.values(config.savegameMapping).includes(savegame.key),
));


export const processingSavegames = new SvelteSet<string>();