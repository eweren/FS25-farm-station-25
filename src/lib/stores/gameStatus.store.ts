import { listen } from '@tauri-apps/api/event';
import { writable, get } from "svelte/store";
import { changePlayState, watchFarmingSimulator } from '../sync/utils';
import { localSavegames, processingSavegames, remoteSavegames, savegamesWithRemote } from './savegamesAndMods.store';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { toast } from 'svelte-sonner';
import { getSavegamesFromDir, syncSavegame } from '../sync/savegames.sync';
import { info } from '@tauri-apps/plugin-log';

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
      info("Farming simulator is running");
    }
  });

  listen("process-started", async (e) => {
    if (get(state) !== GameStatus.STARTING) {
      state.set(GameStatus.STARTING);
      info("Farming simulator started");
      await changePlayState(true);

      const window = getCurrentWindow();
      await window.minimize();
    }
  });

  listen("process-not-running", (e) => {
    if (get(state) !== GameStatus.NOT_RUNNING) {
      state.set(GameStatus.NOT_RUNNING);
      info("Farming simulator is not running");
    }
  });

  listen("process-exited", async (e) => {
    if (get(state) !== GameStatus.EXITED) {
      state.set(GameStatus.EXITED);

      await changePlayState(false);

      const window = getCurrentWindow();
      await window.requestUserAttention(UserAttentionType.Informational);

      await new Promise(res => setTimeout(res, 1000));
      await window.unminimize();
      await window.setFocus();

      const savegames = (await getSavegamesFromDir()) ?? [];
      localSavegames.set(savegames);
      await remoteSavegames.current();
      await new Promise(res => setTimeout(res, 1000))
      const autoSyncableSavegames = get(savegamesWithRemote);

      for (const savegame of autoSyncableSavegames) {
        processingSavegames.add(savegame.id);
        await syncSavegame(savegame, get(cachedT), false);
        processingSavegames.delete(savegame.id);
      }
      toast.success(get(cachedT)("everything_synced"), { dismissable: true, duration: 10000 });
    }
  });

  watchFarmingSimulator();

  return state;
}

/**
 * A store that holds the current status of the farming simulator. Listens to process status events from the rust
 * backend.
 */
export const gameStatus = createGameStatusStore();