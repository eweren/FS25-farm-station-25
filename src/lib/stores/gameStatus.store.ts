import { listen } from '@tauri-apps/api/event';
import { writable, get } from "svelte/store";
import { syncSavegame, watchFarmingSimulator } from '../sync/utils';
import { config, processingSavegames, remoteSavegames, savegamesWithRemote } from './savegames.store';
import { getTolgee } from '@tolgee/svelte';

export enum GameStatus {
  RUNNING = "running",
  EXITED = "exited",
  NOT_RUNNING = "not_running",
  STARTING = "starting",
  UNKNOWN = "unknown"
}

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

  listen("process-exited", (e) => {
    if (get(state) !== GameStatus.EXITED) {
      state.set(GameStatus.EXITED);
      const autoSyncableSavegames = get(savegamesWithRemote);

      autoSyncableSavegames.forEach(async (savegame) => {
        processingSavegames.add(savegame.id);
        // Does not work :( todo
        const tolgee = getTolgee();
        await syncSavegame(savegame, get(remoteSavegames), get(config), tolgee.value.t);
      });
      console.log("Farming simulator exited and starting sync", e);
    }
  });

  watchFarmingSimulator();

  return state;
}

export const gameStatus = createGameStatusStore();