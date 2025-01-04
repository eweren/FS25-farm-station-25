import type { Config } from '../types/config';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { writable } from 'svelte/store';

export const localSavegames = writable<Savegame[]>([]);
export const remoteSavegames = writable<ListObjectResponse[]>([]);
export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});