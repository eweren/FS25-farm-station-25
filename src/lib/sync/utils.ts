import { invoke } from '@tauri-apps/api/core';
import { readDir, BaseDirectory, readFile, exists, writeFile, remove } from '@tauri-apps/plugin-fs';
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { convertXML } from 'simple-xml-to-json';
import type { Config } from '../types/config';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { config, config as configStore, getTitleFromMod, localMods, localOnlyMods, localSavegames, localSavegames as localSavegamesStore, processingAllMods, processingMods, processingSavegames, remoteMods, remoteOnlyMods, remoteSavegames } from '../stores/savegames.store';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import type { Mod, ModResponse } from '../types/mod';

const r2Domain = "r2.eweren.workers.dev"
const protocol = "https"

export const documentsDefaultDir = "My Games\\FarmingSimulator2025";

export const getTeamHeader = () => {
  const teamId = get(config).teamId;

  if (teamId != null) {
    const headers = new Headers();
    headers.append("teamId", teamId);
    return headers;
  }
  return null;
}

export async function getSavegamesFromDir() {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }
  const subfolders = await readDir(dir, {
    baseDir: BaseDirectory.Document,
  });
  const saveGamesFolders = subfolders.filter(
    (folder) => folder.isDirectory && folder.name.match(/^savegame\d/),
  );
  const saveGames = [];

  for (const savegame of saveGamesFolders) {
    const careerSavegame = await readFile(
      `${dir}/${savegame.name}/careerSavegame.xml`,
      {
        baseDir: BaseDirectory.Document,
      },
    )
      .then((file) => new TextDecoder().decode(file))
      .then((fileContent) => convertXML(fileContent))
      .then((json) => {
        return {
          id: savegame.name,
          map: json.careerSavegame.children[0].settings.children.find(
            (c: Record<string, any>) => "mapTitle" in c,
          )?.mapTitle.content as string,
          creationDate: json.careerSavegame.children[0].settings.children.find(
            (c: Record<string, any>) => "creationDate" in c,
          )?.creationDate.content as string,
          saveDate: json.careerSavegame.children[0].settings.children.find(
            (c: Record<string, any>) => "saveDate" in c,
          )?.saveDate.content as string,
          money: parseInt(
            json.careerSavegame?.children
              ?.find((c: Record<string, any>) => "statistics" in c)
              ?.statistics?.children?.find(
                (c: Record<string, any>) => "money" in c,
              )?.money?.content ?? 0,
          ),
          mods: json.careerSavegame?.children?.filter((c: Record<string, any>) => "mod" in c && (c.mod as Mod).modName.startsWith("FS25_"))?.map((c: { mod: Mod }) => c.mod),
          playTime: parseFloat(
            json.careerSavegame?.children
              ?.find((c: Record<string, any>) => "statistics" in c)
              ?.statistics?.children?.find(
                (c: Record<string, any>) => "playTime" in c,
              )?.playTime?.content ?? 0,
          ),
          farms: [],
        } satisfies Savegame
      });

    careerSavegame.farms = await readFile(
      `${dir}/${savegame.name}/farms.xml`,
      {
        baseDir: BaseDirectory.Document,
      },
    )
      .then((file) => new TextDecoder().decode(file))
      .then((fileContent) => convertXML(fileContent))
      .then((json) =>
        json.farms.children.map((f: Record<string, any>) => ({
          name: f.farm.name,
          money: f.farm.money,
          players: f.farm.children
            .find((c: Record<string, any>) => "players" in c)
            ?.players.children.map(
              (c: Record<string, any>) => c.player?.lastNickname as string,
            ) as string,
        })),
      );
    saveGames.push(careerSavegame);
  }

  return saveGames;
}

export async function getLocalMods() {
  const modFiles: Array<Mod> = ((await invoke("read_mod_desc_files")) as Array<Mod & { mod_name: `FS25_${string}` }>).map(e => ({ ...e, modName: e.mod_name })).sort((a, b) => a.modName.localeCompare(b.modName));
  const modMap = new Map<string, Mod>();
  for (const modFile of modFiles) {
    modMap.set(modFile.modName, modFile);
  }

  localMods.set(modMap);

  return modFiles;
}

export async function getSavegameFilesForUpload(saveGame: string) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }

  await invoke("read_file", {
    filename: saveGame,
    path: dir
  }) as string;

  const fileContent = await readFile(`${saveGame}.zip`, {
    baseDir: BaseDirectory.AppLocalData,
  });

  const file = new File([fileContent], `${saveGame}.zip`);

  return file;
}

export async function deleteSavegameZip(saveGame: string) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }

  await remove(`${saveGame}.zip`, {
    baseDir: BaseDirectory.AppLocalData,
  });
}

export async function getLocalModForUpload(mod: Mod) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }
  const fileContent = await readFile(`${dir}/mods/${mod.filename ?? `${mod.modName}.zip`}`, {
    baseDir: BaseDirectory.Document,
  });

  const file = new File([fileContent], mod.filename);

  return file;
}

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
 * Saves the config.
 */
export async function saveConfig(config: Config) {
  try {
    await writeFile("config.json", new TextEncoder().encode(JSON.stringify(config)), {
      baseDir: BaseDirectory.Config
    });
    configStore.set(config);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Loads the config file from the config directory
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

export async function getSavegamesFromRemote() {
  try {
    const headers = getTeamHeader();
    if (!headers) {
      return [];
    }
    const res = await fetch(`${protocol}://${r2Domain}`, { headers });

    if (res.status === 200) {
      const saveGames = await res.json() as Array<ListObjectResponse>;
      return saveGames.map(g => ({ ...g, savegameInfo: { ...g.savegameInfo, isRemote: true } }));
    } else {
      console.error("Failed to fetch save games from remote");
      throw new Error("Failed to fetch save games from remote");
    }
  } catch (e) {
    config.update((c) => ({ savegameMapping: {}, teamId: undefined, inviteCode: undefined, gameDataDirectory: c.gameDataDirectory }));
  }
}

export async function getModsFromRemote() {
  try {
    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    const mods = await fetch(`${protocol}://${r2Domain}/_mods`, { headers }).then(
      (r) => r.json() as Promise<Array<ModResponse>>,
    );

    return mods.sort((a, b) => a.modInfo.modName.localeCompare(b.modInfo.modName));
  } catch (e) {
    config.update((c) => ({ savegameMapping: {}, teamId: undefined, inviteCode: undefined, gameDataDirectory: c.gameDataDirectory }));
  }
}

export async function getFS25Dir(prompt = false) {
  try {
    const dirExists = await exists(documentsDefaultDir, {
      baseDir: BaseDirectory.Document,
    });

    if (!dirExists && prompt) {
      const confirmation = await confirm(
        'This action cannot be reverted. Are you sure?',
        { title: 'Tauri', kind: 'warning' }
      );
      if (!confirmation) {
        return "";
      }
      return await openDir()
    }
    return documentsDefaultDir;
  } catch (e) {
    return await openDir();
  }
}

export async function openDir() {
  const directory = await open({
    multiple: false,
    directory: true,
  });
  if (directory == null) {
    return;
  }
  const modsExist = await exists(`${directory}/mods`);

  if (modsExist) {
    return directory;
  } else {
    return null;
  }
}

export async function watchFarmingSimulator() {
  try {
    await invoke("watch_farming_simulator_25");
  } catch (e) {
    console.error(e);
  }
}

export async function startGame() {
  try {
    await invoke("start_farming_simulator_25");
  } catch (e) {
    console.error(e);
  }
}

export async function syncSavegame(savegame: Savegame, t: TFnType<DefaultParamType, string, TranslationKey>, notifyOnMostRecent: boolean = true) {
  try {
    const remoteSavegame = (await remoteSavegames.current()).find((r) => r.savegameInfo.id === savegame.id);
    if (remoteSavegame) {
      const remoteSavegameDate = new Date(remoteSavegame.savegameInfo.saveDate);
      const localSavegameDate = new Date(savegame.saveDate);

      const onlyRemoteMods = savegame.mods.filter(m => get(remoteOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));
      const onlyLocalMods = savegame.mods.filter(m => get(localOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));

      if (savegame.isRemote || (remoteSavegameDate > localSavegameDate || remoteSavegame.savegameInfo.playTime > savegame.playTime || onlyRemoteMods.length > 0)) {
        await downloadSavegame(remoteSavegame.key, t);
        toast.success(t("sync_completed"));
      } else if (remoteSavegameDate < localSavegameDate || remoteSavegame.savegameInfo.playTime !== savegame.playTime || onlyLocalMods.length > 0) {
        await uploadSavegame(savegame, t);
        toast.success(t("sync_completed"));
      } else if (notifyOnMostRecent) {
        config.update((config) => {
          config.savegameMapping[savegame.id] = remoteSavegame.key;
          return { ...config }
        })
        await saveConfig(get(config));
        toast.info(t("already_synced"));
      }
    } else {
      await uploadSavegame(savegame, t);
    }
  } catch (e) {
    console.error(e);
  }
}

export async function uploadSavegame(saveGame: Savegame, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    let toastNr = toast.loading(t("zip_savegame", { savegame: saveGame.id }), { duration: Infinity });
    const headers = getTeamHeader();
    if (!headers) {
      return;
    }

    let remoteSavegameId = get(config).savegameMapping[saveGame.id];
    if (!remoteSavegameId) {

      const remoteSavegameNames = (await remoteSavegames.current()).map(r => parseInt(r.key.split("/").pop()?.replace("savegame", "")?.replace(".zip", "") ?? "1"));

      const newSavegameId = Math.max(...remoteSavegameNames, 0) + 1;
      remoteSavegameId = `savegame${newSavegameId}.zip`;
    }

    const savegameBuffer = await getSavegameFilesForUpload(saveGame.id);
    if (savegameBuffer == null) {
      toast.dismiss(toastNr);
      return;
    }

    const file = new Blob([savegameBuffer]);

    const formData = new FormData();
    formData.append("file", file);

    const savegameInfo = { ...saveGame, mods: saveGame.mods.length };

    formData.append("savegameInfo", JSON.stringify(savegameInfo));

    toast.dismiss(toastNr);

    toastNr = toast.loading(t("uploading_savegame", { savegame: saveGame.id }), { duration: Infinity });

    const { status, path } = await fetch(
      `${protocol}://${r2Domain}/${remoteSavegameId}`,
      {
        body: formData,
        headers,
        method: "PUT",
      },
    ).then(async (response) => response.json());

    if (status === "success" && path != null) {
      config.update((config) => {
        config.savegameMapping[saveGame.id] = path;
        return { ...config }
      })
      await saveConfig(get(config));
      await remoteSavegames.current();
      processingSavegames.delete(saveGame.id);
      await deleteSavegameZip(saveGame.id);
      await syncModsForSavegame(saveGame, t);
    } else {
      toast(t("error"), { duration: 5000 });
    }
    toast.dismiss(toastNr);
  } catch (e) {
    console.error(e);
  }
}

export async function downloadSavegame(saveGameKey: string, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {

    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    let toastNr = toast.loading(t("downloading_savegame"), { duration: Infinity });

    const data = await fetch(
      `${protocol}://${r2Domain}/${saveGameKey}`,
      {
        method: "GET",
        headers,
      },
    ).then(async (response) => response.arrayBuffer()).then(r => new Uint8Array(r));

    toast.dismiss(toastNr);

    toastNr = toast.loading(t("unzip_savegame"), { duration: Infinity });

    const id = get(localSavegames).find((sg) => get(config).savegameMapping[sg.id] === saveGameKey)?.id;

    // save the files
    const dir = await getFS25Dir();
    if (dir == null) {
      toast.dismiss(toastNr);
      return;
    }
    const saveGame = id ?? `savegame${Math.max(...get(localSavegames).map(s => parseInt(s.id.replace("savegame", ""))), 0) + 1}`;

    const x = await invoke("save_savegame", { data, dir: `${dir}/${saveGame}` });

    if (x) {
      localSavegamesStore.set(await getSavegamesFromDir() ?? get(localSavegames));
      const conf = get(config)
      conf.savegameMapping[saveGame] = saveGameKey;
      await saveConfig(conf);

      const s = get(localSavegamesStore).find(s => s.id === saveGame);
      if (s) {
        await syncModsForSavegame(s, t);
      }
    } else {
      toast(t("error"), { duration: 5000 });
    }

    toast.dismiss(toastNr);
  } catch (e) {
    toast(t("error"), { duration: 5000 });
    console.error(e);
  }
}

/**
 * Syncs all mods of a savegame with remote (either downloading or uploading)
 * @param saveGame the (local) savegame
 * @param t the t function from Tolgee
 */
export async function syncModsForSavegame(saveGame: Savegame, t: TFnType<DefaultParamType, string, TranslationKey>) {

  let toastNr;

  if (saveGame) {
    const onlyRemoteMods = saveGame.mods.filter(m => get(remoteOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));
    const onlyLocalMods = saveGame.mods.filter(m => get(localOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));
    if (onlyRemoteMods.length > 0) {
      for (const mod of onlyRemoteMods) {
        const remMod = get(remoteMods).get(mod.modName);
        if (remMod?.remoteFileName) {
          await downloadMod(remMod?.remoteFileName, mod, t);
        } else {
          setTimeout(() => {
            toast.info(t("mod_not_found_remote", { mod: mod.modName }), { duration: 7000 });
          }, 10);
        }
      }
    }
    if (onlyLocalMods.length > 0) {
      for (const mod of onlyLocalMods) {
        await uploadMod(mod, t);
        toast.dismiss(toastNr);
      }
    }
  }

}

export async function uploadAllMods(t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    const locMods = get(localOnlyMods);
    if (locMods.length === 0) {
      return;
    }
    processingAllMods.set(true);

    for (const mod of locMods) {
      await syncMod(mod, t);
    }

    toast.success(t("every_mod_synced"), { duration: 10000, dismissable: true });

  } catch (e) {
    toast(t("error"), { duration: 5000 });
    console.error(e);
  }
  processingAllMods.set(false);
}

export async function syncMod(mod: Mod, t: TFnType<DefaultParamType, string, TranslationKey>, notifyOnMostRecent: boolean = true) {
  try {
    processingMods.add(mod.modName);
    const remMod = (await remoteMods.current()).find((r) => r.modInfo.modName === mod.modName);
    const locMod = get(localMods).get(mod.modName);
    if (remMod && locMod) {
      if (remMod.modInfo.version.localeCompare(mod.version) > 0) {
        await downloadMod(remMod.key, remMod.modInfo, t);
        toast.success(t("sync_mod_completed"));
      } else if (remMod.modInfo.version.localeCompare(mod.version) < 0) {
        await uploadMod(mod, t);
        toast.success(t("sync_mod_completed"));
      } else if (notifyOnMostRecent) {
        toast.info(t("already_synced"));

      }
    } else if (locMod && !remMod) {
      await uploadMod(mod, t);
      toast.success(t("sync_mod_completed"));
    } else if (!locMod && remMod) {
      await downloadMod(remMod.key, remMod.modInfo, t);
      toast.success(t("sync_mod_completed"));
    } else {
      console.error("No local or remote mod found for sync");
    }
  } catch (e) {
    console.error(e);
  }
  processingMods.delete(mod.modName);
}

export async function uploadMod(mod: Mod, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    const headers = getTeamHeader();
    if (!headers) {
      return;
    }

    const file = await getLocalModForUpload(mod);
    if (file == null) {
      return;
    }
    const toastNr = toast.loading(t("uploading_mod", { title: getTitleFromMod(mod) }), { duration: Infinity });

    const formData = new FormData();
    formData.append("file", file);

    formData.append("modInfo", JSON.stringify(mod));

    const { status } = await fetch(
      `${protocol}://${r2Domain}/${file.name}`,
      {
        body: formData,
        headers,
        method: "PUT",
      },
    ).then(async (response) => response.json());

    if (status === "success") {
      await remoteMods.current();
    } else {
      toast(t("error"), { duration: 5000 });
    }
    toast.dismiss(toastNr);
  } catch (e) {
    console.error(e);
  }
}

export async function downloadMod(key: string, mod: Mod, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {

    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    const toastNr = toast.loading(t("downloading_mod", { title: getTitleFromMod(mod) }), { duration: Infinity });

    // save the files
    const dir = await getFS25Dir();
    if (dir == null) {
      return;
    }

    const data = await fetch(
      `${protocol}://${r2Domain}/${key}`,
      {
        method: "GET",
        headers,
      },
    ).then(async (response) => response.arrayBuffer());

    await writeFile(`${dir}/mods/${mod.filename}`, new Uint8Array(data), {
      baseDir: BaseDirectory.Document,
    });

    await getLocalMods();

    await saveConfig(get(config));
    toast.dismiss(toastNr);
  } catch (e) {
    toast(t("error"), { duration: 5000 });
    console.error(e);
  }
}

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