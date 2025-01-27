export type Mod = {
  modName: string;
  filename: string;
  titles: [{ [lang: string]: Array<string> }] | null;
  description: [{ [lang: string]: Array<string> }] | null;
  version: string;
  remoteFileName?: string;
  fileHash?: string;
}

export type ModResponse = {
  key: string,
  size: number,
  uploaded: string,
  modInfo: Mod
}