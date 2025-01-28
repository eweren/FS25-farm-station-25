<script lang="ts">
  import { onMount } from "svelte";

  import SavegameTable from "../lib/ui/savegameTable.svelte";
  import {
    createTeam as createOrJoinTeam,
    loadConfig,
    saveConfig,
    startGame,
  } from "../lib/sync/utils";
  import {
    localSavegames,
    remoteSavegames,
  } from "../lib/stores/savegamesAndMods.store";
  import { getTolgee, getTranslate, T } from "@tolgee/svelte";
  import { GameStatus, gameStatus } from "../lib/stores/gameStatus.store";
  import { toast } from "svelte-sonner";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Tabs from "$lib/components/ui/tabs";
  import ModsTable from "../lib/ui/modsTable.svelte";
  import { currentLanguage } from "../lib/stores/language.store";
  import CopyCode from "../lib/ui/copyCode.svelte";
  import { Window } from "@tauri-apps/api/window";
  import ExpandableInfoBox from "../lib/ui/expandableInfoBox.svelte";
  import { otherPlayers } from "../lib/stores/playersStatus.store";
  import OtherPlayersDialog from "../lib/ui/otherPlayersDialog.svelte";
  import { getLocalMods } from "../lib/sync/mods.sync";
  import { getSavegamesFromDir } from "../lib/sync/savegames.sync";
  import { appVersion, config } from "../lib/stores/config.store";
  import { remoteMods } from "../lib/stores/savegamesAndMods.store";
  import { error } from "@tauri-apps/plugin-log";
  import LanguageSwitch from "../lib/ui/languageSwitch.svelte";
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
  import { cn } from "../lib/utils";

  let loading = true;

  onMount(async () => {
    try {
      const savegames = (await getSavegamesFromDir()) ?? [];
      localSavegames.set(savegames);
    } catch (e) {
      console.error(e);
      toast.error($t("savegames_loading_error"), {
        duration: 20000,
        dismissable: false,
        cancel: {
          label: $t("copy_path"),
          onClick: () => {
            navigator.clipboard
              .writeText("%LocalAppData%\\de.farm-station-25.app\\logs")
              .then(() => {
                toast.success($t("copied"), {
                  duration: 2000,
                });
              });
            toast.dismiss();
          },
        },
      });
      error(`Error loading local savegames from dir ${e}`);
    }

    try {
      await loadConfig($localSavegames);
    } catch (e) {
      console.error(e);
      toast.error($t("config_loading_error"));
      error(`Error loading config from dir ${e}`);
    }

    try {
      await getLocalMods();
    } catch (e) {
      console.error(e);
      toast.error($t("mods_loading_error"));
      error(`Error loading mods from dir ${e}`);
    }
    loading = false;
    tolgee.subscribe((t) => {
      $currentLanguage = t.getLanguage() ?? "en";
    });
    const window = new Window("main");
    window.setTitle($t("window_title"));
    autostartEnabled = await isEnabled();
  });

  let lastTeamId: string | undefined;
  let showOtherPlayersDialog = false;

  $: {
    if ($config.teamId != lastTeamId && $localSavegames != null) {
      lastTeamId = $config.teamId;
      if (lastTeamId) {
        remoteMods.current();
        remoteSavegames.current();
      }
    }
  }

  let isSubmitting = false;

  const tolgee = getTolgee();

  const { t } = getTranslate();

  let createTeamError: string | null = null;

  let joinStep: "choose" | "join" | "create" = "choose";
  let autostartEnabled = false;

  $: {
    if (joinStep) {
      createTeamError = null;
    }
  }

  let showInviteCode = false;
  let showName = false;
</script>

<main class="container">
  <img
    width="200"
    src="/logo.webp"
    alt="Farming Simulator 25 Logo"
    class="logo"
  />
  <a
    target="_blank"
    class="relative btn-primary flex self-center justify-start gap-2 hover:animate-wiggle skew-x-[-5deg]"
    href="https://ko-fi.com/eweren"
    aria-label="Support me on Kofi"
  >
    <img class="h-6" src="/kofi_symbol.png" alt="Farming Simulator 25 Logo" />
    <T keyName="support_us" />
  </a>

  {#if $config.teamId != null}
    {#if $config.name == null || showName}
      <form
        class="flex-1 flex flex-col gap-4"
        onsubmit={async (e) => {
          if (isSubmitting) {
            return;
          }

          isSubmitting = true;

          // Get the formdata of the formevent
          const formData = new FormData(e.currentTarget);
          const name = formData.get("name") as string;
          if (name.trim().length === 0) {
            toast.error($t("enter_name"));
            isSubmitting = false;
            return;
          }

          await saveConfig({
            ...$config,
            name,
          });
          showInviteCode = true;
          showName = false;
          toast.success($t("name_saved_successfully", { duration: 1500 }));
          isSubmitting = false;
        }}
      >
        <h1 class="font-bold text-xl">
          <T keyName="enter_name_title" />
        </h1>

        <ExpandableInfoBox
          description={$t("name_description")}
          title={$t("name_header")}
        />

        <Input
          value={$config.name}
          type="text"
          name="name"
          placeholder={$t("your_name")}
        />

        <button
          data-umami-event="save_name"
          data-umami-event-name={$config.name}
          disabled={isSubmitting}
          type="submit"
          class="btn-primary mt-auto"
        >
          <T keyName="enter_name_btn" />
        </button>
      </form>
    {:else}
      <button
        class="text-start text-xl flex items-center gap-1 hover:bg-muted/50 p-2 rounded"
        onclick={() => (showInviteCode = !showInviteCode)}
      >
        <span>
          {@html $t("team_header", { teamId: $config.teamId })}
        </span>

        <span
          class={"solar--alt-arrow-left-line-duotone transition-all " +
            (showInviteCode ? "-rotate-90" : "-rotate-180")}
        ></span>
      </button>
      {#if showInviteCode}
        <div class="flex flex-col px-2 items-start justify-start">
          <button onclick={() => (showName = true)}>
            Hi <b>{$config.name}</b> 👋
          </button>
        </div>
      {/if}
      {#if showInviteCode && $config.inviteCode}
        <CopyCode code={$config.inviteCode} />
      {/if}
      <Tabs.Root value="savegames" class="w-full">
        <Tabs.List class="grid w-full grid-cols-2">
          <Tabs.Trigger value="savegames"
            ><T keyName="savegames" /></Tabs.Trigger
          >
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
          {#if $localSavegames == null || $remoteSavegames == null}
            <p>
              <T keyName="savegames_loading" />
            </p>
          {:else}
            <ModsTable />
          {/if}
        </Tabs.Content>
      </Tabs.Root>

      <div class="h-12"></div>
      <button
        data-umami-event="start_game"
        disabled={$gameStatus === GameStatus.RUNNING ||
          $gameStatus === GameStatus.STARTING}
        class="fixed bottom-2 left-2 right-2 btn-primary"
        onclick={async (e) => {
          e.preventDefault();

          if (
            $gameStatus !== GameStatus.RUNNING &&
            $gameStatus !== GameStatus.STARTING
          ) {
            await otherPlayers.updateOtherPlayers();
            if ($otherPlayers.length > 0) {
              showOtherPlayersDialog = true;
            } else {
              toast($t("start_game_status_starting"));
              startGame();
            }
          }
        }}
      >
        <span class="solar--play-outline"></span>
        <T keyName={`start_game_status_${$gameStatus}`} />
      </button>
    {/if}
  {:else if !loading}
    <form
      class="flex-1 flex flex-col gap-4"
      onsubmit={async (e) => {
        if (isSubmitting) {
          return;
        }
        isSubmitting = true;
        // Get the formdata of the formevent
        const formData = new FormData(e.currentTarget);
        const teamId = formData.get("teamId") as string;
        const inviteCode = (formData.get("inviteCode") as string) ?? "";
        if (
          teamId.trim().length === 0 ||
          ((inviteCode?.trim().length ?? 0) === 0 && joinStep === "join")
        ) {
          toast.error($t("missing_fields"));
          isSubmitting = false;
          return;
        }

        const teamRes = await createOrJoinTeam(
          teamId,
          inviteCode,
          joinStep === "create",
        );

        try {
          createTeamError = null;
          if (teamRes.status === "success") {
            await saveConfig({
              ...$config,
              teamId: formData.get("teamId")?.toString(),
              inviteCode: inviteCode || teamRes.inviteCode,
            });
            showName = true;
            showInviteCode = true;
            toast.success($t("team_saved_successfully"), { duration: 1500 });
            isSubmitting = false;
          } else {
            createTeamError = teamRes.reason ?? $t("error");
            isSubmitting = false;
          }
        } catch (error) {
          toast.error($t("team_save_error"));
          isSubmitting = false;
        }
      }}
    >
      <h1 class="font-bold text-xl">
        <T keyName={`join_title_${joinStep}`} />
      </h1>

      {#if joinStep === "choose"}
        <ExpandableInfoBox
          description={$t("join_team_description")}
          title={$t("join_team_header")}
        />
      {/if}

      {#if joinStep === "choose"}
        <div class="flex w-full justify-center gap-4">
          <button
            data-umami-event="select_join_team"
            type="button"
            class="btn-primary"
            onclick={() => (joinStep = "join")}
          >
            <span class="mdi--tractor-variant"></span>
            <T keyName="join" />
          </button>
          <button
            data-umami-event="select_create_team"
            type="button"
            class="btn-primary outline"
            onclick={() => (joinStep = "create")}
          >
            <span class="mdi--house-group-add"></span>
            <T keyName="create" />
          </button>
        </div>
      {:else if joinStep === "join" || joinStep === "create"}
        <button
          type="button"
          class="flex items-center gap-2"
          onclick={() => (joinStep = "choose")}
        >
          <span class="solar--alt-arrow-left-line-duotone"></span>
          <T keyName="back" />
        </button>
        <Input type="text" name="teamId" placeholder={$t("team_id")} />
      {/if}
      {#if joinStep === "join"}
        <Input type="text" name="inviteCode" placeholder={$t("invite_code")} />
      {/if}
      {#if createTeamError}
        <span class="text-destructive">
          {$t(createTeamError)}
        </span>
      {/if}
      {#if joinStep === "join" || joinStep === "create"}
        <button
          disabled={isSubmitting}
          type="submit"
          class="btn-primary mt-auto"
        >
          <T keyName={`join_btn_${joinStep}`} />
        </button>
      {/if}
    </form>
  {:else if loading}
    <span class="text-start text-xl">
      <T keyName="loading" />
    </span>
  {/if}

  <div class="absolute top-2 right-2 text-xs flex items-center gap-2">
    <button
      onclick={async () => {
        if (autostartEnabled) {
          await disable();
          autostartEnabled = await isEnabled();
        } else {
          await enable();
          autostartEnabled = await isEnabled();
        }
      }}
      class={cn(
        "hover:skew-x-[-5deg] py-1 px-2 rounded group",
        autostartEnabled
          ? "text-primary hover:bg-muted hover:text-foreground"
          : "hover:bg-primary",
      )}
    >
      <span class="group-hover:hidden block">
        {autostartEnabled
          ? $t("deactivate_autostart")
          : $t("activate_autostart")}
      </span>
      <span class="group-hover:block hidden">
        {autostartEnabled
          ? $t("deactivate_autostart_action")
          : $t("activate_autostart_action")}
      </span>
    </button>

    <LanguageSwitch />

    v{$appVersion}
    <button
      data-umami-event="reload"
      onclick={() => location.reload()}
      title={$t("reload")}
      aria-label={$t("reload")}
    >
      <span class="solar--refresh-circle-linear -scale-100 hover:animate-spin"
      ></span>
    </button>
  </div>
  {#if $config.teamId}
    <button
      data-umami-event="sign_out"
      class="absolute top-2 left-2 px-2 py-1 flex items-center gap-2 text-sm"
      onclick={() => {
        saveConfig({
          ...$config,
          inviteCode: undefined,
          savegameMapping: {},
          teamId: undefined,
        });
      }}
    >
      <span class="solar--logout-2-outline"></span>
      <T keyName="logout" />
    </button>
  {/if}

  <OtherPlayersDialog bind:isOpen={showOtherPlayersDialog} />
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
    margin: 0 auto 1rem;
    display: block;
  }

  .container {
    margin: 0;
    min-height: 100%;
    overflow: auto;
    padding: 1rem;
    padding-top: 3rem;
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
  .solar--refresh-circle-linear {
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none'%3E%3Cpath fill='%23000' d='M7.378 11.63h-.75zm0 .926l-.562.497a.75.75 0 0 0 1.08.044zm2.141-1.015a.75.75 0 0 0-1.038-1.082zm-2.958-1.038a.75.75 0 1 0-1.122.994zm8.37-1.494a.75.75 0 1 0 1.102-1.018zM12.045 6.25c-2.986 0-5.416 2.403-5.416 5.38h1.5c0-2.137 1.747-3.88 3.916-3.88zm-5.416 5.38v.926h1.5v-.926zm1.269 1.467l1.622-1.556l-1.038-1.082l-1.622 1.555zm.042-1.039l-1.378-1.555l-1.122.994l1.377 1.556zm8.094-4.067a5.42 5.42 0 0 0-3.99-1.741v1.5a3.92 3.92 0 0 1 2.889 1.26zm.585 3.453l.56-.498a.75.75 0 0 0-1.08-.043zm-2.139 1.014a.75.75 0 1 0 1.04 1.082zm2.96 1.04a.75.75 0 0 0 1.12-.997zm-8.393 1.507a.75.75 0 0 0-1.094 1.026zm2.888 2.745c2.993 0 5.434-2.4 5.434-5.38h-1.5c0 2.135-1.753 3.88-3.934 3.88zm5.434-5.38v-.926h-1.5v.926zm-1.27-1.467l-1.619 1.555l1.04 1.082l1.618-1.555zm-.04 1.04l1.38 1.554l1.122-.996l-1.381-1.555zM7.952 16.03a5.45 5.45 0 0 0 3.982 1.719v-1.5c-1.143 0-2.17-.48-2.888-1.245z'/%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23000' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .solar--logout-2-outline {
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M14.945 1.25c-1.367 0-2.47 0-3.337.117c-.9.12-1.658.38-2.26.981c-.524.525-.79 1.17-.929 1.928c-.135.737-.161 1.638-.167 2.72a.75.75 0 0 0 1.5.008c.006-1.093.034-1.868.142-2.457c.105-.566.272-.895.515-1.138c.277-.277.666-.457 1.4-.556c.755-.101 1.756-.103 3.191-.103h1c1.436 0 2.437.002 3.192.103c.734.099 1.122.28 1.4.556c.276.277.456.665.555 1.4c.102.754.103 1.756.103 3.191v8c0 1.435-.001 2.436-.103 3.192c-.099.734-.279 1.122-.556 1.399s-.665.457-1.399.556c-.755.101-1.756.103-3.192.103h-1c-1.435 0-2.436-.002-3.192-.103c-.733-.099-1.122-.28-1.399-.556c-.243-.244-.41-.572-.515-1.138c-.108-.589-.136-1.364-.142-2.457a.75.75 0 1 0-1.5.008c.006 1.082.032 1.983.167 2.72c.14.758.405 1.403.93 1.928c.601.602 1.36.86 2.26.982c.866.116 1.969.116 3.336.116h1.11c1.368 0 2.47 0 3.337-.116c.9-.122 1.658-.38 2.26-.982s.86-1.36.982-2.26c.116-.867.116-1.97.116-3.337v-8.11c0-1.367 0-2.47-.116-3.337c-.121-.9-.38-1.658-.982-2.26s-1.36-.86-2.26-.981c-.867-.117-1.97-.117-3.337-.117z'/%3E%3Cpath fill='%23000' d='M15 11.25a.75.75 0 0 1 0 1.5H4.027l1.961 1.68a.75.75 0 1 1-.976 1.14l-3.5-3a.75.75 0 0 1 0-1.14l3.5-3a.75.75 0 1 1 .976 1.14l-1.96 1.68z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .mdi--tractor-variant {
    display: inline-block;
    width: 1.5rem;
    height: 1.5rem;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m13.3 2.79l-3.5 3.5l.7.71l1.4-1.39l1.1 1.1V9c0 1.11-.89 2-2 2h-.54A6 6 0 0 1 12 15a6 6 0 0 1-.09 1h3.12a4.5 4.5 0 0 1 4.47-4a4.5 4.5 0 0 1 2.5.76V8c0-1.11-.89-2-2-2h-6.29l-1.1-1.1L14 3.5zM4 7c-.55 0-1 .45-1 1s.45 1 1 1h5a2 2 0 0 0-2-2zm2 3a5 5 0 0 0-1.56.25l.36.93l-.47.18l-.33-.93a5 5 0 0 0-2.46 2.31l.91.41l-.21.45l-.9-.4A5 5 0 0 0 1 15a5 5 0 0 0 .25 1.56l.93-.36l.18.47l-.93.33a5 5 0 0 0 2.31 2.46l.4-.91l.46.21l-.4.9A5 5 0 0 0 6 20a5 5 0 0 0 1.56-.25l-.36-.93l.47-.18l.33.93a5 5 0 0 0 2.46-2.31l-.91-.4l.21-.46l.9.4A5 5 0 0 0 11 15a5 5 0 0 0-.25-1.56l-.93.36l-.18-.47l.93-.33a5 5 0 0 0-2.31-2.46l-.4.91l-.46-.21l.4-.9A5 5 0 0 0 6 10m0 2a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m13.5 1a3.5 3.5 0 0 0-3.5 3.5a3.5 3.5 0 0 0 3.5 3.5a3.5 3.5 0 0 0 3.5-3.5a3.5 3.5 0 0 0-3.5-3.5m0 2a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5a1.5 1.5 0 0 1-1.5-1.5a1.5 1.5 0 0 1 1.5-1.5'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .mdi--house-group-add {
    display: inline-block;
    width: 1.5rem;
    height: 1.5rem;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M2 6H1l4-4l4 4H8v3H6V6H4v3H2zm11 4.9l1.3 1.1H16V9h2v3h3V8h1l-5-5l-5 5h1zm.8 11.1c-.5-.9-.8-1.9-.8-3c0-1.6.6-3.1 1.7-4.1L9 10l-7 6h2v6h3v-5h4v5zm4.2-7v3h-3v2h3v3h2v-3h3v-2h-3v-3z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
