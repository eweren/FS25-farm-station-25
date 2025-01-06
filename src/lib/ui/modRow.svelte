<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTolgee, getTranslate } from "@tolgee/svelte";
  import {
    localMods,
    processingAllMods,
    processingMods,
  } from "../stores/savegames.store";
  import type { Mod } from "../types/mod";
  import { syncMod } from "../sync/utils";

  const { t } = getTranslate();
  const tolgee = getTolgee();

  export let mod: Mod;
  export let type: "sync" | "local" | "remote";

  $: tolgeeLang = tolgee.value.getLanguage() ?? "en";

  const localModIfPresent = $localMods.get(mod.modName);

  $: title =
    localModIfPresent?.titles != null &&
    tolgeeLang in localModIfPresent.titles?.[0]
      ? localModIfPresent.titles[0][tolgeeLang][0]
      : localModIfPresent?.titles != null
        ? Object.values(localModIfPresent.titles[0])[0][0]
        : mod.modName;
</script>

<Table.Row>
  <Table.Cell class="min-w-full">
    {title}
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
      title={$t("sync_savegame")}
      aria-label={$t("sync_savegame")}
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
</style>
