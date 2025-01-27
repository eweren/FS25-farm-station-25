import type { Savegame } from './savegame';

export type ListObjectResponse = {
  key: string;
  size: number;
  uploaded: string;
  savegameInfo: Savegame;
}