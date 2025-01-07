import { listen } from '@tauri-apps/api/event';
import { writable, get } from "svelte/store";
import { changePlayState, syncSavegame, watchFarmingSimulator } from '../sync/utils';
import { processingSavegames, savegamesWithRemote } from './savegames.store';
import { type DefaultParamType, type TFnType, type TranslationKey } from '@tolgee/svelte';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { toast } from 'svelte-sonner';

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

  listen("process-started", async (e) => {
    if (get(state) !== GameStatus.STARTING) {
      state.set(GameStatus.STARTING);
      console.log("Farming simulator started", e);
      await changePlayState(true);

      const window = getCurrentWindow();
      await window.minimize();
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

      await changePlayState(false);

      const window = getCurrentWindow();
      await window.requestUserAttention(UserAttentionType.Informational);
      await window.unminimize()
      await window.setFocus();
      const autoSyncableSavegames = get(savegamesWithRemote);
      await new Promise(res => setTimeout(res, 1000))

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

export const gameStatus = createGameStatusStore();