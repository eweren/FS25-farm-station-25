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

/**
 * A store that holds the list of other players in the game.
 */
export const otherPlayers = createOtherPlayersStore();