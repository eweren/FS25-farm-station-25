export interface Config {
  savegameMapping: Record<string, string>;
  gameDataDirectory: string;
  teamId?: string;
  inviteCode?: string;
  name?: string;
}