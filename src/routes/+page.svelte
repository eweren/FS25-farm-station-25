<script lang="ts">
  import { onMount } from "svelte";

  import SavegameTable from "../lib/ui/savegameTable.svelte";
  import {
    createTeam,
    getLocalMods,
    getSavegamesFromDir,
    loadConfig,
    saveConfig,
    startGame,
  } from "../lib/sync/utils";
  import {
    config,
    localSavegames,
    remoteMods,
    remoteSavegames,
  } from "../lib/stores/savegames.store";
  import { getTolgee, getTranslate, T } from "@tolgee/svelte";
  import { GameStatus, gameStatus } from "../lib/stores/gameStatus.store";
  import { toast } from "svelte-sonner";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import * as Tabs from "$lib/components/ui/tabs";
  import ModsTable from "../lib/ui/modsTable.svelte";
  import { currentLanguage } from "../lib/stores/language.store";

  let loading = true;

  onMount(async () => {
    localSavegames.set((await getSavegamesFromDir()) ?? []);
    config.set(await loadConfig($localSavegames));
    await getLocalMods();
    loading = false;
    tolgee.subscribe((t) => {
      $currentLanguage = t.getLanguage() ?? "en";
    });
  });

  let lastTeamId: string | undefined;

  $: {
    if ($config.teamId != lastTeamId) {
      lastTeamId = $config.teamId;
      if (lastTeamId) {
        remoteMods.current();
        remoteSavegames.current();
      }
    }
  }

  const tolgee = getTolgee();

  const { t } = getTranslate();

  let createTeamError: string | null = null;
</script>

<main class="container">
  <img
    width="200"
    src="/logo.webp"
    alt="Farming Simulator 25 Logo"
    class="logo"
  />

  {#if $config.teamId != null}
    <span class="text-start text-xl">
      {@html $t("team_header", { teamId: $config.teamId })}
    </span>
    <Tabs.Root value="savegames" class="w-full">
      <Tabs.List class="grid w-full grid-cols-2">
        <Tabs.Trigger value="savegames"><T keyName="savegames" /></Tabs.Trigger>
        <Tabs.Trigger value="mods"><T keyName="mods" /></Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="savegames">
        <div class="savegames">
          {#if $localSavegames == null || $remoteSavegames == null}
            <p>
              <T keyName="savegames_loading" />
            </p>
          {:else if $localSavegames.length === 0 && $remoteSavegames.length === 0}
            <p>
              <T keyName="savegames_no_found" />
            </p>
          {:else}
            <SavegameTable />
          {/if}
        </div>
      </Tabs.Content>
      <Tabs.Content value="mods">
        <ModsTable />
      </Tabs.Content>
    </Tabs.Root>
    <div class="h-12"></div>
    <button
      disabled={$gameStatus === GameStatus.RUNNING ||
        $gameStatus === GameStatus.STARTING}
      class="fixed bottom-2 left-2 right-2 btn-primary"
      onclick={(e) => {
        e.preventDefault();

        if (
          $gameStatus !== GameStatus.RUNNING &&
          $gameStatus !== GameStatus.STARTING
        ) {
          toast($t("start_game_status_starting"));
          startGame();
        }
      }}
    >
      <span class="solar--play-outline"></span>
      <T keyName={`start_game_status_${$gameStatus}`} />
    </button>
  {:else if !loading}
    <form
      class="flex-1 flex flex-col gap-4"
      onsubmit={async (e) => {
        // Get the formdata of the formevent
        const formData = new FormData(e.currentTarget);
        // Create a new team with the form data
        const teamRes = await createTeam(
          formData.get("teamId") as string,
          formData.get("inviteCode") as string,
        );

        try {
          if (teamRes.status === "success") {
            await saveConfig({
              ...$config,
              teamId: formData.get("teamId")?.toString(),
              inviteCode: formData.get("inviteCode")?.toString(),
            });
            toast($t("team_saved_successfully"));
          } else {
            // toast.error($t("team_save_error"));
            createTeamError = teamRes.reason;
          }
        } catch (error) {
          toast.error($t("team_save_error"));
        }
      }}
    >
      <Alert.Root class="text-left">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          ><g fill="none"
            ><circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="1.5"
            /><path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.5"
              d="M12 17v-6"
            /><circle
              cx="1"
              cy="1"
              r="1"
              fill="currentColor"
              transform="matrix(1 0 0 -1 11 9)"
            /></g
          ></svg
        >
        <Alert.Title class="font-bold">Team beitreten</Alert.Title>
        <Alert.Description>
          Erstelle jetzt ein Farming Simulator 25 Team, mit dem Du Deine
          Spielstände und Mods teilen willst, oder trete dem Team eines Freundes
          bei.
        </Alert.Description>
      </Alert.Root>
      <div class="flex w-full items-start flex-col gap-1.5">
        <Input type="text" name="teamId" placeholder={$t("team_id")} />
      </div>
      <div class="flex w-full items-start flex-col gap-1.5">
        <Input type="text" name="inviteCode" placeholder={$t("invite_code")} />
      </div>
      {#if createTeamError}
        <span class="text-destructive text-start">
          {$t(createTeamError)}
        </span>
      {/if}
      <button class="mt-auto btn-primary"> Team erstellen / beitreten </button>
    </form>
  {:else if loading}
    <span class="text-start text-xl">
      <T keyName="loading" />
    </span>
  {/if}

  <button
    class="absolute top-2 right-2 px-2 py-1"
    onclick={() => location.reload()}
  >
    <T keyName="reload" />
  </button>
</main>

<style>
  :root {
    font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;

    --fs-color-primary: #74a301;
    --fs-color-primary-light: #9abf05;
    --fs-color-dark: #313035;
  }

  .savegames {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 100%;
    overflow: auto;
  }

  .logo {
    margin: 1rem auto;
    display: block;
  }

  .container {
    margin: 0;
    min-height: 100%;
    overflow: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: start;
    text-align: center;
    gap: 0.75rem;
    position: relative;
  }
  .solar--info-circle-linear {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none'%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23000' stroke-width='1.5'/%3E%3Cpath stroke='%23000' stroke-linecap='round' stroke-width='1.5' d='M12 17v-6'/%3E%3Ccircle cx='1' cy='1' r='1' fill='%23000' transform='matrix(1 0 0 -1 11 9)'/%3E%3C/g%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
