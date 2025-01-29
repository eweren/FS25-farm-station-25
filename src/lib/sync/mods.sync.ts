import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { localMods, allLocalMods, processingAllMods, processingMods, remoteMods } from '../stores/savegamesAndMods.store';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import type { Mod, ModResponse } from '../types/mod';
import { getFS25Dir, getTeamHeader } from './shared.sync';
import { protocol, baseDomain } from './utils';
import { currentLanguage } from '../stores/language.store';
import { error } from '@tauri-apps/plugin-log';
import { config } from '../stores/config.store';

/**
 * Takes a mod and returns its title in the current language. If no title exists, it returns the default name of the mod. 
 * @param mod the mod to get the title from
 * @returns either the title in current locale, or the first present title, or the modname or "Unknown"
 */
export const getTitleFromMod = (mod: Pick<Mod, "titles" | "modName">) => {
  if (mod.titles) {
    const lang = get(currentLanguage);
    const title = mod.titles.find(t => typeof t === "object" ? lang in t : t)?.[lang]?.[0] ?? Object.values(mod.titles?.[0])?.[0]?.[0] ?? mod.modName;
    return title;
  } else if (mod.modName) {
    return mod.modName;
  } else {
    return "Unknown";
  }
}

/**
 * Takes a mod and returns its title in the current language. If no title exists, it returns the default name of the mod. 
 * @param mod the mod to get the title from
 * @returns either the title in current locale, or the first present title, or the modname or "Unknown"
 */
export const getDescriptionFromMod = (mod: Mod) => {
  if (mod.description) {
    const lang = get(currentLanguage);
    const description = mod.description?.find(t => typeof t === "object" ? lang in t : t)?.[lang]?.[0] ?? Object.values(mod.description?.[0])?.[0]?.[0] ?? null
    return description?.trim() ?? "";
  } else {
    return "";
  }
}

/**
 * Get all local mods. Invoves a rust backend function that loads and reads all the mod description files.
 * @returns an array of local mods. Each mod is an object with properties such as `mod_name`, `description`, and `author`.
 */
export async function getLocalMods() {
  const data = ((await invoke("read_mod_desc_files")) as Array<Mod>);
  const modFiles: Array<Mod> = data?.sort((a, b) => a.modName.localeCompare(b.modName));
  const modMap = new Map<string, Mod>();
  for (const modFile of modFiles) {
    modMap.set(modFile.modName + modFile.version, modFile);
  }

  console.log(modMap);

  localMods.set(modMap);

  return modFiles;
}

/**
 * Loads a local mod file for upload. Mods are typically already zipped, so this zip will just be returned.
 * @param mod the mod to be uploaded
 * @returns the file object of the mod
 */
export async function getLocalModForUpload(mod: Mod) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }
  const fileContent = await readFile(`${dir}/mods/${mod.filename ?? `${mod.modName}.zip`}`, {
    baseDir: BaseDirectory.Document,
  });

  const file = new File([fileContent], mod.filename ?? `${mod.modName}.zip`);

  return file;
}

/**
 * Loads metadata for all mods from the remote server.
 * @returns the list of mods from the remote server
 */
export async function getModsFromRemote() {
  try {
    const headers = getTeamHeader();
    if (!headers) {
      return;
    }
    const mods = await fetch(`${protocol}://${baseDomain}/_mods`, { headers })
      .then((r) => {
        if (r.status === 401) {
          config.set({ ...get(config), teamId: undefined, inviteCode: undefined, savegameMapping: {} });
          error("Unauthorized to get mods from remote");
          return [];
        }
        return r.json();
      }) as Array<ModResponse>;

    return mods.sort((a, b) => a.modInfo.modName.localeCompare(b.modInfo.modName));
  } catch (e) {
    error(`Error getting mods from remote: ${e}`);
  }
}

/**
 *  Uploads all mods to the remote server.
 * @param t the tolgee t function to localize toast messages
 */
export async function uploadAllMods(t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    const locMods = get(allLocalMods);
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
    error(`Error uploading all mods ${e}`);
  }
  processingAllMods.set(false);
}

/**
 * Downloads or uploads a single mod to the remote server, based if it exists locally or remotely.
 * @param mod the mod to sync
 * @param t the tolgee t function to localize toast messages
 * @param notifyOnMostRecent whether to notify if the most recent version is already synced
 */
export async function syncMod(mod: Mod, t: TFnType<DefaultParamType, string, TranslationKey>, notifyOnMostRecent: boolean = true) {
  try {
    processingMods.add(mod.modName);
    const remMod = (await remoteMods.current()).find((r) => r.modInfo.modName === mod.modName && r.modInfo.version === mod.version);
    const locMod = get(localMods).get(mod.modName + mod.version);

    if (remMod && locMod) {
      if (remMod.modInfo.version.localeCompare(mod.version) > 0) {
        umami.track('download_mod', { mod: remMod.modInfo.modName });
        await downloadMod(remMod.key, remMod.modInfo, t);
        toast.success(t("sync_mod_completed", { mod: getTitleFromMod(mod) }));
      } else if (remMod.modInfo.version.localeCompare(mod.version) < 0) {
        umami.track('upload_mod', { mod: remMod.modInfo.modName });
        await uploadMod(mod, t, true);
      } else if (notifyOnMostRecent) {
        toast.info(t("already_synced"));

      }
    } else if (locMod && !remMod) {
      umami.track('upload_mod', { mod: mod.modName });
      await uploadMod(mod, t, true);
      toast.success(t("sync_mod_completed", { mod: getTitleFromMod(mod) }));
    } else if (!locMod && remMod) {
      umami.track('download_mod', { mod: remMod.modInfo.modName });
      await downloadMod(remMod.key, remMod.modInfo, t);
      toast.success(t("sync_mod_completed", { mod: getTitleFromMod(mod) }));
    } else {
      error("No local or remote mod found for sync");
    }
  } catch (e) {
    error(`Error syncing mod: ${e}`);
  }
  processingMods.delete(mod.modName);
}

/**
 * Uploads a mod to the server.
 * @param mod the mod to upload
 * @param t tolgee t function to localize toast messages
 */
export async function uploadMod(mod: Mod, t: TFnType<DefaultParamType, string, TranslationKey>, notifySuccess = false) {
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
      `${protocol}://${baseDomain}/${file.name ?? `${mod.modName}.zip`}`,
      {
        body: formData,
        headers,
        method: "PUT",
      },
    ).then(async (response) => response.json());

    toast.dismiss(toastNr);
    if (status === "success") {
      await remoteMods.current();
      if (notifySuccess) {
        toast.success(t("sync_mod_completed", { mod: getTitleFromMod(mod) }));
      }
    } else {
      toast(t("error"), { duration: 5000 });
    }
  } catch (e) {
    error(`Error uploading mod: ${e}`);
  }
}

/**
 * Downloads a mod from the server and saves it to the local filesystem.
 * @param key the key of the mod to download
 * @param mod the mod object containing information about the mod
 * @param t tolgee t function to localize toasts
 */
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

    processingMods.add(mod.modName);

    console.log(key);

    const data = await fetch(
      `${protocol}://${baseDomain}/${key}`,
      {
        method: "GET",
        headers,
      },
    ).then(async (response) => response.arrayBuffer());

    await writeFile(`${dir}/mods/${mod.filename ?? `${mod.modName}.zip`}`, new Uint8Array(data), {
      baseDir: BaseDirectory.Document,
    });

    localMods.update((mods) => {
      mods.set(mod.modName + mod.version, mod);
      return new Map(mods);
    })

    processingMods.add(mod.modName);

    toast.dismiss(toastNr);
    toast.success(t("download_mod_completed", { mod: getTitleFromMod(mod) }));
  } catch (e) {
    toast(t("error"), { duration: 5000 });
    error(`Error downloading mod: ${e}`);
  }
}