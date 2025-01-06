export type Mod = {
  modName: `FS25_${string}`;
  filename: `FS25_${string}.zip`;
  titles: [{ [lang: string]: Array<string> }];
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