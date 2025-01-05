import { invoke } from '@tauri-apps/api/core';
import { readDir, BaseDirectory, readFile, exists, writeFile, stat, mkdir } from '@tauri-apps/plugin-fs';
import JSZip from 'jszip';
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { convertXML } from 'simple-xml-to-json';
import type { Config } from '../types/config';
import type { ListObjectResponse } from '../types/listObjectResponse';
import type { Savegame } from '../types/savegame';
import { config as configStore, localSavegames as localSavegamesStore } from '../stores/savegames.store';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { getTranslate, type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import type { Readable } from "svelte/store";

export const documentsDefaultDir = "My Games\\FarmingSimulator2025";

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
      .then((json) => ({
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
        playTime: parseFloat(
          json.careerSavegame?.children
            ?.find((c: Record<string, any>) => "statistics" in c)
            ?.statistics?.children?.find(
              (c: Record<string, any>) => "playTime" in c,
            )?.playTime?.content ?? 0,
        ),
        farms: [],
      }));
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


export async function getSavegameFilesForUpload(saveGame: string) {
  const dir = await getFS25Dir();
  if (dir == null) {
    return;
  }
  const fileUris = await readDir(`${dir}/${saveGame}`, {
    baseDir: BaseDirectory.Document,
  });

  const files: Array<File> = [];

  for (const fileUri of fileUris) {

    const fileContent = await readFile(`${dir}/${saveGame}/${fileUri.name}`, {
      baseDir: BaseDirectory.Document,
    });

    const file = new File([fileContent], fileUri.name);
    files.push(file);
  }

  return files;
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
  const saveGames = await fetch("https://r2.eweren.workers.dev").then(
    (r) => r.json() as Promise<Array<ListObjectResponse>>,
  );

  return saveGames;
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

export async function createZip(saveGame: string) {
  try {
    const savegameFiles = await getSavegameFilesForUpload(saveGame);
    if (savegameFiles == null) {
      return;
    }
    const zip = new JSZip();

    savegameFiles?.forEach((file) => {
      zip.file(file.name, file);
    });


    const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    const file = new File([content], `${saveGame}.zip`);
    // upload
    const formData = new FormData();
    formData.append("file", file);

    const savegames = await getSavegamesFromDir();
    const saveGameInfo = savegames?.find((sg) => sg.id === saveGame);
    formData.append("savegameInfo", JSON.stringify(saveGameInfo));

    const { status } = await fetch(
      `https://r2.eweren.workers.dev/${file.name}`,
      {
        body: formData,
        method: "PUT",
      },
    ).then(async (response) => response.json());

    if (status === "success") {
      console.log("File uploaded successfully");
    }
  } catch (e) {
    console.error(e);
  }
}

export async function selectFileToUpload() {
  const fileUri = await open({
    multiple: false,
    directory: false,
  });
  if (fileUri == null) {
    return;
  }
  const fileContent = await readFile(fileUri);

  const file = new File([fileContent], fileUri.split(/\\|\//g).pop()!);

  await uploadData(file);
}

export async function syncSavegame(savegame: Savegame, remoteSavegames: ListObjectResponse[], config: Config, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    const remoteSavegame = remoteSavegames.find((r) => r.savegameInfo.id === savegame.id);
    if (remoteSavegame) {
      const remoteSavegameDate = new Date(remoteSavegame.savegameInfo.saveDate);
      const localSavegameDate = new Date(savegame.saveDate);
      if (remoteSavegameDate > localSavegameDate || remoteSavegame.savegameInfo.playTime > savegame.playTime) {
        await downloadSavegame(remoteSavegame.key, get(localSavegamesStore), config, t);
        toast(t("sync_completed"), { duration: 2000 });
      } else if (remoteSavegameDate < localSavegameDate && remoteSavegame.savegameInfo.playTime !== savegame.playTime) {
        await uploadSavegame(savegame, remoteSavegames, config, t);
        toast(t("sync_completed"), { duration: 2000 });
      } else {
        toast(t("already_synced"), { duration: 2000 });

      }
    } else {
      await uploadSavegame(savegame, remoteSavegames, config, t);
    }
  } catch (e) {
    console.error(e);
  }
}

export async function uploadSavegame(saveGame: Savegame, remoteSavegames: ListObjectResponse[], config: Config, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    let remoteSavegameId = config.savegameMapping[saveGame.id];
    if (!remoteSavegameId) {
      const remoteSavegameNames = remoteSavegames.map(r => parseInt(r.key.replace("savegame", "").replace(".zip", "")));
      const newSavegameId = Math.max(...remoteSavegameNames, 0) + 1;
      remoteSavegameId = `savegame${newSavegameId}.zip`;
    }

    const savegameFiles = await getSavegameFilesForUpload(saveGame.id);
    if (savegameFiles == null) {
      return;
    }
    const toastNr = toast(t("uploading_savegame"), { duration: Infinity });
    const zip = new JSZip();

    savegameFiles?.forEach((file) => {
      zip.file(file.name, file);
    });

    const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    const file = new File([content], remoteSavegameId);

    const formData = new FormData();
    formData.append("file", file);

    formData.append("savegameInfo", JSON.stringify(saveGame));

    const { status } = await fetch(
      `https://r2.eweren.workers.dev/${file.name}`,
      {
        body: formData,
        method: "PUT",
      },
    ).then(async (response) => response.json());

    if (status === "success") {
      config.savegameMapping[saveGame.id] = remoteSavegameId;
      await saveConfig(config);
      console.log("File uploaded successfully");
    } else {
      toast(t("error"), { duration: 5000 });
    }
    toast.dismiss(toastNr);
  } catch (e) {
    console.error(e);
  }
}

export async function downloadSavegame(saveGameKey: string, localSavegames: Savegame[], config: Config, t: TFnType<DefaultParamType, string, TranslationKey>) {
  try {
    const toastNr = toast(t("downloading_savegame"), { duration: Infinity });

    const data = await fetch(
      `https://r2.eweren.workers.dev/${saveGameKey}`,
      {
        method: "GET",
      },
    ).then(async (response) => response.blob());

    // unzip the file
    const zip = new JSZip();
    const content = await zip.loadAsync(data);

    // save the files
    const dir = await getFS25Dir();
    if (dir == null) {
      return;
    }

    const saveGame = localSavegames.find((sg) => config.savegameMapping[sg.id] === saveGameKey)?.id ?? `savegame${Math.max(...localSavegames.map(s => parseInt(s.id.replace("savegame", ""))), 0) + 1}`;

    // check if directory exists and create it if not
    let dirExists = await exists(`${dir}/${saveGame}`, {
      baseDir: BaseDirectory.Document,
    });

    if (!dirExists) {
      await mkdir(`${dir}/${saveGame}`, {
        baseDir: BaseDirectory.Document,
      });
    }
    dirExists = await exists(`${dir}/${saveGame}`, {
      baseDir: BaseDirectory.Document,
    });

    const files = Object.keys(content.files).map(async (file) => {
      const fileContent = await content.file(file)!.async("blob");
      const arrayBuffer = await fileContent.arrayBuffer();
      await writeFile(`${dir}/${saveGame}/${file}`, new Uint8Array(arrayBuffer), {
        baseDir: BaseDirectory.Document,
      });
    });

    await Promise.all(files);

    console.log("Downloaded")

    localSavegamesStore.set(await getSavegamesFromDir() ?? localSavegames);
    config.savegameMapping[saveGame] = saveGameKey;
    await saveConfig(config);
    toast.dismiss(toastNr);
  } catch (e) {
    toast(t("error"), { duration: 5000 });
    console.error(e);
  }
}

export async function uploadData(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { status } = await fetch(
    `https://r2.eweren.workers.dev/${file.name}`,
    {
      body: formData,
      method: "PUT",
    },
  ).then(async (response) => response.json());

  if (status === "success") {
    console.log("File uploaded successfully");
  } else {
    console.error("Error uploading file");
  }
}