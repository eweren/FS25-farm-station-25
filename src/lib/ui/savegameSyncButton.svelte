<script lang="ts">
  import { getTranslate } from "@tolgee/svelte";

  import {
    localMods,
    processingSavegames,
    remoteSavegames,
  } from "../stores/savegamesAndMods.store";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { Savegame } from "../types/savegame";
  import {
    downloadSavegame,
    syncSavegame,
    uploadSavegame,
  } from "../sync/savegames.sync";
  import type { EnhancedSavegame } from "../types/listObjectResponse";

  type SavegameSyncButtonProps = {
    savegame: EnhancedSavegame;
    type: "local" | "remote" | "both";
  };

  const { savegame, type }: SavegameSyncButtonProps = $props();

  const { t } = getTranslate();

  const remoteSavegame = $derived(
    $remoteSavegames.find((r) => r.savegameInfo.id === savegame.id),
  );
  const remoteSavegameDate = $derived(
    remoteSavegame ? new Date(remoteSavegame.savegameInfo.saveDate) : null,
  );
  const localSavegameDate = $derived(new Date(savegame.saveDate));

  const isSynced = $derived(
    type === "both" &&
      remoteSavegameDate?.valueOf() === localSavegameDate.valueOf() &&
      remoteSavegame?.savegameInfo.playTime === savegame.playTime &&
      $localMods
        .keys()
        .filter((localMod) =>
          savegame.mods.some((m) => m.modName + m.version === localMod),
        )
        .toArray().length === savegame.mods.length,
  );

  $effect(() =>
    console.log(
      isSynced,
      $localMods
        .keys()
        .filter((localMod) =>
          savegame.mods.some((m) => m.modName + m.version === localMod),
        )
        .toArray().length,
      savegame.mods.length,
    ),
  );
  const canUpload = $derived(
    (remoteSavegameDate?.valueOf() ?? 0) < localSavegameDate.valueOf() ||
      (remoteSavegame?.savegameInfo.playTime ?? 0) < savegame.playTime,
  );
  const canDownload = $derived(
    (remoteSavegameDate?.valueOf() ?? 0) > localSavegameDate.valueOf() ||
      (remoteSavegame?.savegameInfo.playTime ?? 0) > savegame.playTime ||
      $localMods
        .keys()
        .filter((localMod) =>
          savegame.mods.some((m) => m.modName + m.version === localMod),
        )
        .toArray().length !== savegame.mods.length,
  );
</script>

<Tooltip.Root>
  <Tooltip.Trigger class="relative">
    <button
      class="bg-primary text-white btn-primary aspect-square !p-2 relative"
      disabled={processingSavegames.has(savegame.id) || isSynced}
      onclick={async () => {
        processingSavegames.add(savegame.id);
        if (type === "local") {
          await uploadSavegame(savegame, $t);
        } else if (type === "remote" && savegame.isRemote) {
          await downloadSavegame(savegame.info.key, $t);
        } else {
          await syncSavegame(savegame, $t);
        }
        processingSavegames.delete(savegame.id);
      }}
      aria-label={type === "local" || canUpload
        ? $t("upload_savegame")
        : type === "remote" || canDownload
          ? $t("download_savegame")
          : $t("already_synced")}
    >
      {#if processingSavegames.has(savegame.id)}
        <span
          class="solar--refresh-bold animate-[spin_1s_linear_reverse_infinite]"
        ></span>
      {:else if type === "both"}
        {#if savegame.isRemote}
          <span class="solar--cloud-download-outline"></span>
        {:else if canDownload}
          <span class="solar--cloud-download-outline"></span>
        {:else if canUpload}
          <span class="solar--cloud-upload-outline"></span>
        {:else}
          <span class="solar--check-circle-linear"></span>
        {/if}
      {:else if type === "local"}
        <span class="solar--cloud-upload-outline"></span>
      {:else if type === "remote"}
        <span class="solar--cloud-download-outline"></span>
      {/if}
    </button>
    {#if type === "both" && !isSynced}
      <div
        class="aspect-square w-5 h-5 bg-amber-500 absolute -top-2 -right-2 rounded-full flex items-center justify-center"
      >
        <span class="solar--refresh-bold !w-4 !h-4"></span>
      </div>
    {/if}
  </Tooltip.Trigger>
  <Tooltip.Content>
    {type === "local" || canUpload
      ? $t("upload_savegame")
      : type === "remote" || canDownload
        ? $t("download_savegame")
        : $t("already_synced")}
  </Tooltip.Content>
</Tooltip.Root>
