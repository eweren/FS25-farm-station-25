export interface Config {
  savegameMapping: { [localSavegameId: string]: string };
  gameDataDirectory: string;
  teamId?: string;
  inviteCode?: string;
  name?: string;
  lang?: string;
}