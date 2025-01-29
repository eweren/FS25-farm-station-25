import type { Savegame } from './savegame';

export type ListObjectResponse = {
  key: string;
  size: number;
  uploaded: string;
  savegameInfo: Savegame;
}

export type EnhancedSavegame = Savegame & {
  location: "remote" | "local" | "both";
  info: Omit<ListObjectResponse, "savegameInfo">;
};