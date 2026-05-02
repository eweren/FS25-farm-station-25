import { BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { get } from 'svelte/store';
import { documentsDefaultDir } from './utils';
import { config } from '../stores/config.store';
import { error } from '@tauri-apps/plugin-log';

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
  // Prefer a previously-saved game directory from the config – this also covers
  // macOS / Linux users who don't have a Windows-style "My Games" folder under
  // Documents and previously had to re-pick the directory every launch.
  const savedDir = get(config).gameDataDirectory;
  if (savedDir && savedDir.length > 0 && savedDir !== documentsDefaultDir) {
    try {
      const savedExists = await exists(savedDir);
      if (savedExists) {
        return savedDir;
      }
    } catch (e) {
      // exists() may throw on absolute paths that the fs scope doesn't grant
      // access to; fall through to the default behaviour in that case.
      error(`getFS25Dir saved-dir check failed: ${e}`);
    }
  }

  try {
    const dirExists = await exists(documentsDefaultDir, {
      baseDir: BaseDirectory.Document,
    });

    if (dirExists) {
      return documentsDefaultDir;
    }

    if (prompt) {
      const confirmation = await confirm(
        "We couldn't find a data-directory for your Farming Simulator 25 game. Please specify.",
        { title: 'No FS25 directory found', kind: 'warning' }
      );
      if (!confirmation) {
        return "";
      }
      return await openDir();
    }
    return documentsDefaultDir;
  } catch (e) {
    error(`getFS25Dir default-dir check failed: ${e}`);
    if (prompt) {
      return await openDir();
    }
    return documentsDefaultDir;
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
  try {
    const modsExist = await exists(`${directory}/mods`);
    if (modsExist) {
      return directory;
    }
  } catch (e) {
    error(`openDir mods-check failed: ${e}`);
  }
  return null;
}
