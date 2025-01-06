import type { Mod } from "./mod";

export type Savegame = {
  id: string;
  map: string;
  creationDate: string;
  saveDate: string;
  money: number;
  mods: Array<Mod>;
  playTime: number;
  farms: {
    name: string,
    money: string,
    players: Array<string>,
  }[];
};
