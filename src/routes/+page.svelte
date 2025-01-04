<script lang="ts">
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";

  import SavegameTable from "../lib/ui/savegameTable.svelte";
  import type { Savegame } from "../lib/types/savegame";
  import type { ListObjectResponse } from "../lib/types/listObjectResponse";
  import {
    createZip,
    getSavegamesFromDir,
    getSavegamesFromRemote,
    loadConfig,
    openDir,
    startGame,
  } from "../lib/sync/utils";
  import type { Config } from "../lib/types/config";
  import {
    config,
    localSavegames,
    remoteSavegames,
  } from "../lib/stores/savegames.store";

  listen("process-running", (e) => {
    console.log("Farming simulator is running", e);
  });

  listen("process-started", (e) => {
    console.log("Farming simulator started", e);
  });

  listen("process-not-running", (e) => {
    console.log("Farming simulator is not running", e);
  });

  listen("process-exited", (e) => {
    console.log("Farming simulator exited", e);
  });

  onMount(async () => {
    localSavegames.set((await getSavegamesFromDir()) ?? []);
    config.set(await loadConfig($localSavegames));
    try {
      remoteSavegames.set(await getSavegamesFromRemote());
    } catch (error) {
      console.error("Error fetching S3 buckets:", error);
    }
  });
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
      <p>Spielstände werden geladen</p>
    {:else if $localSavegames.length === 0 && $remoteSavegames.length === 0}
      <p>Keine lokalen Spielstände gefunden</p>
    {:else}
      <SavegameTable />
    {/if}
  </div>

  <button class="absolute top-2 right-2" onclick={() => location.reload()}>
    Reload
  </button>

  <div class="h-8"></div>
  <button class="fixed bottom-2 right-2 left-2" onclick={startGame}>
    <span class="solar--play-outline"></span>
    FS25 starten
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
