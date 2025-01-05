<script lang="ts">
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";

  import SavegameTable from "../lib/ui/savegameTable.svelte";
  import {
    getSavegamesFromDir,
    getSavegamesFromRemote,
    loadConfig,
    startGame,
  } from "../lib/sync/utils";
  import {
    config,
    localSavegames,
    remoteSavegames,
  } from "../lib/stores/savegames.store";
  import { getTranslate, T } from "@tolgee/svelte";
  import { GameStatus, gameStatus } from "../lib/stores/gameStatus.store";
  import { toast } from "svelte-sonner";

  onMount(async () => {
    localSavegames.set((await getSavegamesFromDir()) ?? []);
    config.set(await loadConfig($localSavegames));
    try {
      remoteSavegames.set(await getSavegamesFromRemote());
    } catch (error) {
      console.error("Error fetching S3 buckets:", error);
    }
  });

  const { t } = getTranslate();
</script>

<main class="container">
  <img
    width="200"
    src="/logo.webp"
    alt="Farming Simulator 25 Logo"
    class="logo"
  />

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

  <button
    class="absolute top-2 right-2 px-2 py-1"
    onclick={() => location.reload()}
  >
    <T keyName="reload" />
  </button>

  <div class="h-8"></div>
  <button
    disabled={$gameStatus === GameStatus.RUNNING ||
      $gameStatus === GameStatus.STARTING}
    class="fixed bottom-2 right-2 left-2"
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
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
    position: relative;
  }
</style>
