import { writable, readable, get } from "svelte/store";
import type { Config } from '../types/config';
import { invoke } from '@tauri-apps/api/core';
import { error, info } from '@tauri-apps/plugin-log';

/** An array of all the configuration settings  */
export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});

const createAppVersion = () => {
  const appVersion = writable<string>()
  invoke('get_version_number').then((version) => {
    info('App version:' + version);
    if (typeof version === "string") {
      appVersion.set(version);
    }
  }).catch((e) => {
    error('Error fetching app version:', e);
    appVersion.set("Unknown");
  });
  return appVersion;
};

export const appVersion = createAppVersion();