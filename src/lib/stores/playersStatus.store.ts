import { writable } from "svelte/store";
import { getPlayerStatus } from '../sync/utils';

const createOtherPlayersStore = () => {
  const otherPlayers = writable<Array<string>>([]);

  const updateOtherPlayers = async () => {
    otherPlayers.set(await getPlayerStatus() ?? []);
  }

  return {
    ...otherPlayers,
    updateOtherPlayers
  };
}

export const otherPlayers = createOtherPlayersStore();