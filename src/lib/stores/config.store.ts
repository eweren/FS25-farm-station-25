import { writable } from "svelte/store";
import type { Config } from '../types/config';


/** An array of all the configuration settings  */
export const config = writable<Config>({
  savegameMapping: {},
  gameDataDirectory: "",
});