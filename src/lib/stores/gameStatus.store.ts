import { listen } from '@tauri-apps/api/event';
import { writable, get } from "svelte/store";
import { syncSavegame, watchFarmingSimulator } from '../sync/utils';
import { config, processingSavegames, remoteSavegames, savegamesWithRemote } from './savegames.store';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';

export enum GameStatus {
  RUNNING = "running",
  EXITED = "exited",
  NOT_RUNNING = "not_running",
  STARTING = "starting",
  UNKNOWN = "unknown"
}

export const cachedT = writable<TFnType<DefaultParamType, string, TranslationKey>>((props) => props.toString());

const createGameStatusStore = () => {
  const state = writable<GameStatus>(GameStatus.UNKNOWN);


  listen("process-running", (e) => {
    if (get(state) !== GameStatus.RUNNING) {
      state.set(GameStatus.RUNNING);
      console.log("Farming simulator is running", e);
    }
  });

  listen("process-started", (e) => {
    if (get(state) !== GameStatus.STARTING) {
      state.set(GameStatus.STARTING);
      console.log("Farming simulator started", e);
    }
  });

  listen("process-not-running", (e) => {
    if (get(state) !== GameStatus.NOT_RUNNING) {
      state.set(GameStatus.NOT_RUNNING);
      console.log("Farming simulator is not running", e);
    }
  });

  listen("process-exited", async (e) => {
    if (get(state) !== GameStatus.EXITED) {
      state.set(GameStatus.EXITED);
      const autoSyncableSavegames = get(savegamesWithRemote);
      await new Promise(res => setTimeout(res, 1000))

      console.log("Farming simulator exited and starting sync", e, autoSyncableSavegames.length);
      for (const savegame of autoSyncableSavegames) {
        processingSavegames.add(savegame.id);
        console.log("Syncing", savegame.id);
        await syncSavegame(savegame, get(cachedT), false);
        processingSavegames.delete(savegame.id);
      }
      console.log("Sync complete", e);
    }
  });

  watchFarmingSimulator();

  return state;
}

export const gameStatus = createGameStatusStore();