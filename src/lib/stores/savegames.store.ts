import type { Config } from '../types/config';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { writable, derived, get } from 'svelte/store';
import { SvelteSet } from "svelte/reactivity";
import { getModsFromRemote, getSavegamesFromRemote } from '../sync/utils';
import type { Mod } from '../types/mod';
import { currentLanguage } from './language.store';

export const getTitleFromMod = (mod: Mod) => {
  if (mod.titles) {
    const lang = get(currentLanguage);
    return lang in mod.titles[0] ? mod.titles[0][lang][0] : Object.values(mod.titles[0])?.[0]?.[0] ?? mod.modName;
  } else if (mod.modName) {
    return mod.modName;
  } else {
    return "Unknown";
  }

}

export const localSavegames = writable<Savegame[]>([]);
export const remoteSavegames = (() => {
  const savegames = writable<ListObjectResponse[]>([]);

  const current = async () => {
    const currentSavegames = await getSavegamesFromRemote();
    savegames.set(currentSavegames);
    return currentSavegames;
  }

  return {
    ...savegames,
    current
  }
})();

export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});

export const localMods = writable<Map<string, Mod>>(new Map());
export const remoteMods = (() => {
  const mods = writable<Map<string, Mod>>(new Map());

  const current = async () => {
    const currentMods = await getModsFromRemote() ?? [];
    const modMap = new Map<string, Mod>();
    for (const modFile of currentMods) {
      modMap.set(modFile.modInfo.modName, { ...modFile.modInfo, remoteFileName: modFile.key });
    }
    mods.set(modMap);
    return currentMods;
  }

  return {
    ...mods,
    current
  }
})();

export const remoteOnlyMods = derived([localSavegames, localMods, remoteMods], ([localSavegames, localMods, remoteMods]) => {
  const uniqueMods = new Set(localSavegames.flatMap(s => s.mods).filter((mod) => !localMods.has(mod.modName)));
  const mods = [...Array.from(uniqueMods).map(mod => remoteMods.get(mod.modName) ?? mod)].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  console.log("Remote only mods: ", mods.length);
  return mods;
});

export const localOnlyMods = derived([localMods, remoteMods], ([localMods, remoteMods]) => {
  const mods = [...Array.from(localMods.values()).filter(mod => !remoteMods.has(mod.modName))].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  console.log("Local only mods: ", mods.length);
  return mods;
});

export const syncedMods = derived([localMods, remoteMods], ([localMods, remoteMods]) => {
  const mods = [...Array.from(localMods.values()).filter(mod => remoteMods.has(mod.modName))].sort((a, b) => getTitleFromMod(a).localeCompare(getTitleFromMod(b)));
  console.log("Synced mods: ", mods.length);
  return mods;
});

export const processingMods = new SvelteSet<string>();
export const processingAllMods = writable<boolean>(false);

export const savegamesWithRemote = derived([localSavegames, config, remoteSavegames], ([localSavegames, { savegameMapping }, remoteSavegames]) => localSavegames.filter(
  (savegame) => {
    const savegames = savegameMapping[savegame.id] != null &&
      remoteSavegames.some(
        (s) => s.key === savegameMapping[savegame.id],
      );
    console.log("Synced savegames: ", JSON.parse(JSON.stringify({ localId: savegame.id, remoteSavegames: remoteSavegames.map(m => m.key) })), JSON.parse(JSON.stringify(savegameMapping)));
    return savegames;

  }
));

export const localOnlySavegames = derived([localSavegames, config, remoteSavegames], ([localSavegames, { savegameMapping }, remoteSavegames]) => localSavegames.filter(
  (savegame) =>
    savegameMapping[savegame.id] == null ||
    !remoteSavegames.some(
      (s) => s.key === savegameMapping[savegame.id],
    ),
));

export const remoteOnlySavegames = derived([config, remoteSavegames], ([{ savegameMapping }, remoteSavegames]) => remoteSavegames.filter(
  (savegame) => !Object.values(savegameMapping).includes(savegame.key),
));


export const processingSavegames = new SvelteSet<string>();