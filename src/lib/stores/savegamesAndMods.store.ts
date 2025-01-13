import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { writable, derived } from 'svelte/store';
import { SvelteSet } from "svelte/reactivity";
import { getSavegamesFromRemote } from '../sync/savegames.sync';
import { config } from './config.store';
import type { Mod } from '../types/mod';
import { getModsFromRemote, getTitleFromMod } from '../sync/mods.sync';

/** An array of all the local savegames */
export const localSavegames = writable<Savegame[]>([]);

/** An array of all the remote savegames */
export const remoteSavegames = (() => {
  const savegames = writable<ListObjectResponse[]>([]);

  const current = async () => {
    const currentSavegames = await getSavegamesFromRemote() ?? [];
    savegames.set(currentSavegames);
    return currentSavegames;
  }

  return {
    ...savegames,
    current
  }
})();


/** An array of all the local mods */
export const localMods = writable<Map<string, Mod>>(new Map());

/** An array of all the remote mods */
export const remoteMods = (() => {
  const mods = writable<Map<string, Mod>>(new Map());

  const current = async () => {
    const currentMods = await getModsFromRemote() ?? [];
    const modMap = new Map<string, Mod>();
    for (const modFile of currentMods) {
      modMap.set(modFile.modInfo.modName + modFile.modInfo.version, { ...modFile.modInfo, remoteFileName: modFile.key });
    }
    mods.set(modMap);
    return currentMods;
  }

  return {
    ...mods,
    current
  }
})();

/** An array of all mods that are only on the remote server */
export const remoteOnlyMods = derived([localSavegames, localMods, remoteMods], ([localSavegames, localMods, remoteMods]) => {
  const uniqueMods = new Set(localSavegames.flatMap(s => s.mods).filter((mod) => !localMods.has(mod.modName + mod.version)));
  const mods = [...Array.from(uniqueMods).map(mod => remoteMods.get(mod.modName) ?? mod)].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  return mods;
});

/** An array of all mods that are only on the local server */
export const localOnlyMods = derived([localMods, remoteMods], ([localMods, remoteMods]) => {
  const mods = [...Array.from(localMods.values()).filter(mod => !remoteMods.has(mod.modName + mod.version))].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  return mods;
});

/** An array of all mods that are synced between the local and remote server */
export const syncedMods = derived([localMods, remoteMods], ([localMods, remoteMods]) => {
  const mods = [...Array.from(localMods.values()).filter(mod => remoteMods.has(mod.modName + mod.version))].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  return mods;
});

/** A set of all mods that are currently being processed */
export const processingMods = new SvelteSet<string>();

/** A writable boolean indicating whether all mods are currently being processed */
export const processingAllMods = writable<boolean>(false);

/** An array of all savegames that are synced between local and remote */
export const savegamesWithRemote = derived([localSavegames, config, remoteSavegames], ([localSavegames, { savegameMapping }, remoteSavegames]) => localSavegames.filter(
  (savegame) => savegameMapping[savegame.id] != null &&
    remoteSavegames.some(
      (s) => s.key === savegameMapping[savegame.id],
    )
));

/** An array of all savegames that are only saved locally */
export const localOnlySavegames = derived([localSavegames, config, remoteSavegames], ([localSavegames, { savegameMapping }, remoteSavegames]) => localSavegames.filter(
  (savegame) =>
    savegameMapping[savegame.id] == null ||
    !remoteSavegames.some(
      (s) => s.key === savegameMapping[savegame.id],
    ),
));

/** An array of all savegames that are only saved remotely */
export const remoteOnlySavegames = derived([config, remoteSavegames], ([{ savegameMapping }, remoteSavegames]) => remoteSavegames.filter(
  (savegame) => !Object.values(savegameMapping).includes(savegame.key),
));


/** An array of all savegames that are currently being processed */
export const processingSavegames = new SvelteSet<string>();