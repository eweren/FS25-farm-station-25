import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, readFile, remove } from '@tauri-apps/plugin-fs';
import { localMods, localSavegames, localSavegames as localSavegamesStore, processingSavegames, remoteSavegames } from '../stores/savegamesAndMods.store';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import { getFS25Dir, getTeamHeader } from './shared.sync';
import { downloadMod, uploadMod } from './mods.sync';
import { protocol, baseDomain, saveConfig } from './utils';
import { config } from '../stores/config.store';
import { remoteOnlyMods, localOnlyMods, remoteMods } from '../stores/savegamesAndMods.store';
import { error, info } from '@tauri-apps/plugin-log';
import type { CareerSavegame } from '../genTypes/CareerSavegame';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import SelectModSlot from '../ui/selectModSlot.svelte';
import { type ComponentType } from 'svelte';

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
    const res = await fetch(`${protocol}://${baseDomain}`, { headers });

    if (res.status === 200) {
      const saveGames = await res.json() as Array<ListObjectResponse>;
      return saveGames.map(g => ({ ...g, savegameInfo: { ...g.savegameInfo, isRemote: true } }));
    } else {
      error("Failed to fetch save games from remote");
      throw new Error("Failed to fetch save games from remote");
    }
  } catch (e) {
    error(`Failed to fetch save games from remote: ${e}`);
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

  await invoke("read_files_as_zip", {
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
  const saveGamesFolders = await invoke("get_folder_content", { dir }) as Array<string>;


  const saveGames: Array<Savegame> = [];

  for (const savegame of saveGamesFolders) {
    const loadedSavegame = await invoke("parse_local_savegame_data", { savegamePath: `${dir}/${savegame}` }) as CareerSavegame;

    if (loadedSavegame == null) {
      // savegameFolder is probably a steam folder without real content
      continue;
    }

    saveGames.push({
      id: savegame,
      creationDate: loadedSavegame.settings.creationDate,
      map: loadedSavegame.settings.mapTitle,
      mods: loadedSavegame.mod?.map((mod) => ({
        filename: `${mod.modName}.zip` as `FS25_${string}.zip`,
        modName: mod.modName as `FS25_${string}`,
        version: mod.version,
        titles: [{ en: [mod.title] }],
        fileHash: mod.fileHash,
      })) ?? [],
      money: loadedSavegame.statistics.money,
      name: loadedSavegame.settings.savegameName,
      playTime: loadedSavegame.statistics.playTime,
      saveDate: loadedSavegame.settings.saveDate,
      isRemote: false,
      farms: loadedSavegame.farms?.farm.map((f) => ({
        money: `${f.money}`,
        name: f.name,
        players: f.players.player.map((p) => p.lastNickname)
      })) ?? [],
    });
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
      const _savegameModsAsStrings = savegame.isRemote ? [] : savegame.mods.map((m) => (m.modName + m.version).trim());
      const _remoteOnlyMods = savegame.isRemote ? [] : get(localMods)
        .keys()
        .filter((localMod) =>
          _savegameModsAsStrings.includes(localMod.trim())
        )
        .toArray();

      debugger
      if (savegame.isRemote || (remoteSavegameDate > localSavegameDate || remoteSavegame.savegameInfo.playTime > savegame.playTime)) {
        if (savegame.isRemote) {

          const toastId = toast.custom(SelectModSlot as unknown as ComponentType, {
            componentProps: {
              onCancel: () => {
                console.log("Cancelled")
                toast.dismiss(toastId);
              },
              onSelectionChange: async (savegameId: string) => {
                console.log(savegameId);
                toast.dismiss(toastId);
                await downloadSavegame(remoteSavegame.key, t, savegameId);
                toast.success(t("sync_completed"));
              }
            },
            duration: Infinity
          });
        } else {
          await downloadSavegame(remoteSavegame.key, t);
          toast.success(t("sync_completed"));
        }

      } else if (remoteSavegameDate < localSavegameDate || remoteSavegame.savegameInfo.playTime !== savegame.playTime) {
        await uploadSavegame(savegame, t);
        toast.success(t("sync_completed"));
      } else if (notifyOnMostRecent) {
        let _config = get(config);
        _config.savegameMapping[savegame.id] = remoteSavegame.key;

        await saveConfig(_config);
        toast.info(t("already_synced"));
      }

      if (_remoteOnlyMods.length > 0) {
        info(`Remote has mods that local doesn't have: ${_remoteOnlyMods.join(", ")}. Starting to download them.`);
        await syncModsForSavegame(savegame, t);
      }
    } else {
      await uploadSavegame(savegame, t);
    }
  } catch (e) {
    error(`Error syncing savegame: ${e}`);
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

    const savegameInfo = { ...saveGame, mods: saveGame.mods?.length ?? 0 };

    formData.append("savegameInfo", JSON.stringify(savegameInfo));

    toast.dismiss(toastNr);

    toastNr = toast.loading(t("uploading_savegame", { savegame: saveGame.id }), { duration: Infinity });

    const { status, path } = await fetch(
      `${protocol}://${baseDomain}/${remoteSavegameId}`,
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
    error(`Error uploading savegame: ${e}`);
  }
}

/**
 * Downloads a savegame from the server and saves it to the local file system.
 * @param saveGameKey the key of the savegame to download (remote-key)
 * @param t the tolgee t function to localize the toasts
 */
export async function downloadSavegame(saveGameKey: string, t: TFnType<DefaultParamType, string, TranslationKey>, overrideSavegameId: null | string = null) {
  try {

    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    let toastNr = toast.loading(t("downloading_savegame"), { duration: Infinity });

    const data = await fetch(
      `${protocol}://${baseDomain}/${saveGameKey}`,
      {
        method: "GET",
        headers,
      },
    ).then(async (response) => response.arrayBuffer()).then(r => new Uint8Array(r));

    toast.dismiss(toastNr);

    toastNr = toast.loading(t("unzip_savegame"), { duration: Infinity });

    const id = overrideSavegameId ?? get(localSavegames).find((sg) => get(config).savegameMapping[sg.id] === saveGameKey)?.id;

    // save the files
    const dir = await getFS25Dir();
    if (dir == null) {
      toast.dismiss(toastNr);
      return;
    }
    const saveGame = id ?? `savegame${Math.max(...get(localSavegames).map(s => parseInt(s.id.replace("savegame", ""))), 0) + 1}`;

    const x = await invoke("unwrap_and_save_savegame", { data, dir: `${dir}/${saveGame}` });

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
    error(`Error downloading savegame: ${e}`);
  }
}


/**
 * Syncs all mods of a savegame with remote (either downloading or uploading)
 * @param saveGame the (local) savegame
 * @param t the t function from Tolgee
 */
export async function syncModsForSavegame(saveGame: Savegame, t: TFnType<DefaultParamType, string, TranslationKey>) {
  info(`Syncing mods for savegame ${saveGame.id}`);
  let toastNr;

  if (saveGame) {
    const onlyRemoteMods = saveGame.mods.filter(m => get(remoteOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));
    const onlyLocalMods = saveGame.mods.filter(m => get(localOnlyMods).some(mod => m.filename === m.filename && m.version === mod.version));
    if (onlyRemoteMods.length > 0) {
      for (const mod of onlyRemoteMods) {
        const remMod = get(remoteMods).get(mod.modName + mod.version);
        if (remMod?.remoteFileName) {
          info(`Downloading mod ${remMod.remoteFileName}`);
          await downloadMod(remMod?.remoteFileName, mod, t);
          toast.success(t("sync_mod_completed"));
        } else {
          setTimeout(() => {
            toast.info(t("mod_not_found_remote", { mod: mod.modName }), { duration: 7000 });
          }, 10);
        }
      }
    }
    if (onlyLocalMods.length > 0) {
      for (const mod of onlyLocalMods) {
        info(`Uploading mod ${mod.filename}`);
        await uploadMod(mod, t, true);
      }
    }
  }

}