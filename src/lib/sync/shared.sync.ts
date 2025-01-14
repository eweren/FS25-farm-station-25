import { BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { get } from 'svelte/store';
import { documentsDefaultDir } from './utils';
import { config } from '../stores/config.store';

/**
 * Creates a teamId header for all backend requests to identify the team
 */
export const getTeamHeader = () => {
  const _config = get(config);
  const teamId = _config.teamId;
  const lang = _config.lang;

  const headers = new Headers();
  if (lang != null) {
    headers.append("lang", lang);
  }

  if (teamId != null) {
    headers.append("teamId", teamId);
    return headers;
  }
  return null;
}

/**
 * Returns the FS25 data directory (or triggers an openDir command if the default did not succeed)
 * @param prompt if the user should be prompted if the defaultDir does not exist
 */
export async function getFS25Dir(prompt = false) {
  try {
    const dirExists = await exists(documentsDefaultDir, {
      baseDir: BaseDirectory.Document,
    });

    if (!dirExists && prompt) {
      const confirmation = await confirm(
        "We couldn't find a data-directory for your Farming Simulator 25 game. Please specify.",
        { title: 'No FS25 directory found', kind: 'warning' }
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

/**
 * Opens a directory picker and instantly checks if a `mods` folder exists
 */
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
