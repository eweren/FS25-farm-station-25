export type Savegame = {
  id: string;
  map: string;
  creationDate: string;
  saveDate: string;
  money: number;
  playTime: number;
  farms: {
    name: string,
    money: string,
    players: Array<string>,
  }[];
};