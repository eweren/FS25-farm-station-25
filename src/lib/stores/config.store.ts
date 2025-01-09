import { writable, readable, get } from "svelte/store";
import type { Config } from '../types/config';
import { invoke } from '@tauri-apps/api/core';

/** An array of all the configuration settings  */
export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});

const createAppVersion = () => {
  const appVersion = writable<string>()
  invoke('get_version_number').then((version) => {
    console.log(typeof version);
    if (typeof version === "string") {
      appVersion.set(version);
    }
  }).catch((error) => {
    console.error('Error fetching app version:', error);
    appVersion.set("Unknown");
  });
  return appVersion;
};

export const appVersion = createAppVersion();