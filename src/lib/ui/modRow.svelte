<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate } from "@tolgee/svelte";
  import {
    processingAllMods,
    processingMods,
  } from "../stores/savegamesAndMods.store";
  import type { Mod } from "../types/mod";
  import {
    getDescriptionFromMod,
    getTitleFromMod,
    syncMod,
  } from "../sync/mods.sync";

  const { t } = getTranslate();

  export let mod: Mod;
  export let type: "sync" | "local" | "remote";

  $: title = $t("back") ? getTitleFromMod(mod) : mod.modName;
  $: description = $t("back") ? getDescriptionFromMod(mod) : null;
</script>

<Table.Row>
  <Table.Cell class="min-w-full">
    <div class="flex flex-col items-start justify-start">
      <span>{title}</span>
      {#if description && description !== title}
        <span
          title={description}
          class="description line-clamp-2 text-ellipsis overflow-hidden text-foreground text-xs"
        >
          {description}</span
        >
      {/if}
    </div>
  </Table.Cell>
  <Table.Cell class="min-w-full">
    {mod.version}
  </Table.Cell>
  <Table.Cell class="text-right flex justify-end">
    <button
      class="bg-primary text-white btn-primary"
      disabled={processingMods.has(mod.modName) ||
        type === "sync" ||
        $processingAllMods}
      onclick={async () => {
        await syncMod(mod, $t);
      }}
      title={type === "sync"
        ? $t("sync_mod")
        : type === "local"
          ? $t("upload_mod")
          : $t("download_mod")}
      aria-label="{type === 'sync'
        ? $t('sync_mod')
        : type === 'local'
          ? $t('upload_mod')
          : $t('download_mod')}}"
    >
      {#if processingMods.has(mod.modName)}
        <span
          class="solar--refresh-bold w-1 h-1 animate-[spin_1s_linear_reverse_infinite]"
        ></span>
      {:else if type === "sync"}
        <span class="solar--check-circle-linear w-1 h-1"></span>
      {:else if type === "local"}
        <span class="solar--cloud-upload-outline w-1 h-1"></span>
      {:else if type === "remote"}
        <span class="solar--cloud-download-outline w-1 h-1"></span>
      {/if}
    </button>
  </Table.Cell>
</Table.Row>

<style>
  button.btn-primary {
    padding: 0.5rem;
  }
  .description {
    max-width: calc(100vw - 16rem);
  }
</style>
