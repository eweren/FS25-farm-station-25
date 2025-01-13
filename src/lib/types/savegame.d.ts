import type { Mod } from "./mod";

export type Savegame = {
  id: string;
  name: string;
  map: string;
  creationDate: string;
  saveDate: string;
  money: number;
  mods: Array<Mod>;
  playTime: number;
  isRemote?: boolean;
  farms: {
    name: string,
    money: string,
    players: Array<string>,
  }[];
};
