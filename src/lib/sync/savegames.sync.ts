import { invoke } from '@tauri-apps/api/core';
import { readDir, BaseDirectory, readFile, remove } from '@tauri-apps/plugin-fs';
import { convertXML } from 'simple-xml-to-json';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { localSavegames, localSavegames as localSavegamesStore, processingSavegames, remoteSavegames } from '../stores/savegamesAndMods.store';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import type { Mod } from '../types/mod';
import { getFS25Dir, getTeamHeader } from './shared.sync';
import { downloadMod, uploadMod } from './mods.sync';
import { protocol, r2Domain, saveConfig } from './utils';
import { config } from '../stores/config.store';
import { remoteOnlyMods, localOnlyMods, remoteMods } from '../stores/savegamesAndMods.store';

/**
 * Fetches metadata for all savegames of the team from remote.
 * @returns an array of all remote savegames
 */
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

/**
 * Triggers the backend to take the folder of the specified saveGame and zip it. Then uses this path to read the file
 * and return it.
 * @param saveGame the savegame to read (e.g. `savegame1`)
 * @returns a File containing the zipped savegame
 */
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

/**
 * Deletes a zip of a savegame from the `AppLocalData` dir. Should be called when the zip was successfully uploaded.
 * @param saveGame the savegame to delete (e.g. `savegame1`)
 */
export async function deleteSavegameZip(saveGame: string) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }

  await remove(`${saveGame}.zip`, {
    baseDir: BaseDirectory.AppLocalData,
  });
}

/**
 * Reads the FS25 data directory and searches for `savegame{x}` folders, reads the `careerSavegame.xml` and `farms.xml`
 * for each found savegame to get relevant infos for it.
 * @returns an array of savegames
 */
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
  const saveGames: Array<Savegame> = [];

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

/**
 * Syncs a savegame with the server.
 * Is determining if the remoteSavegame or the local one is newer and takes steps based on this info
 * If remote has more playTime or is newer  -> download
 * If local is newer or has more playtime -> upload
 * If both matches -> show `already_synced`
 * @param savegame 
 * @param t 
 * @param notifyOnMostRecent 
 */
export async function syncSavegame(savegame: Savegame, t: TFnType<DefaultParamType, string, TranslationKey>, notifyOnMostRecent: boolean = true) {
  try {
    const remoteSavegame = (await remoteSavegames.current()).find((r) => r.savegameInfo.id === savegame.id);
    if (remoteSavegame) {
      const remoteSavegameDate = new Date(remoteSavegame.savegameInfo.saveDate);
      const localSavegameDate = new Date(savegame.saveDate);

      if (savegame.isRemote || (remoteSavegameDate > localSavegameDate || remoteSavegame.savegameInfo.playTime > savegame.playTime)) {
        await downloadSavegame(remoteSavegame.key, t);
        toast.success(t("sync_completed"));
      } else if (remoteSavegameDate < localSavegameDate || remoteSavegame.savegameInfo.playTime !== savegame.playTime) {
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

/**
 * Uploads the savegame to the server. Is zipping it first and then sending the blob to backend.
 * @param saveGame the savegame to upload
 * @param t the tolgee t function to localize the toasts
 */
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
      let _config = get(config);
      _config.savegameMapping[saveGame.id] = path
      await saveConfig(_config);
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

/**
 * Downloads a savegame from the server and saves it to the local file system.
 * @param saveGameKey the key of the savegame to download (remote-key)
 * @param t the tolgee t function to localize the toasts
 */
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