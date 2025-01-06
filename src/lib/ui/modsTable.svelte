<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate, T } from "@tolgee/svelte";
  import {
    localMods,
    localOnlyMods,
    localOnlySavegames,
    processingMods,
    remoteMods,
    remoteOnlyMods,
    syncedMods,
  } from "../stores/savegames.store";
  import ModRow from "./modRow.svelte";
  import { uploadAllMods } from "../sync/utils";

  const { t } = getTranslate();
</script>

<Table.Root>
  <Table.Header>
    <Table.Row class="text-left pointer-events-none">
      <Table.Head>
        <T keyName="mod_name" />
      </Table.Head>
      <Table.Head class="text-left">
        <T keyName="version" />
      </Table.Head>
      <Table.Head class="text-right">
        <T keyName="status" /></Table.Head
      >
    </Table.Row>
  </Table.Header>
  <Table.Body class="text-left text-primary">
    {#if $remoteOnlyMods.length > 0}
      <Table.Row>
        <Table.Cell
          class="text-start text-default pointer-events-none bg-slate-500/10"
          colspan={3}
        >
          <T keyName="remote_mods" />
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $remoteOnlyMods as mod}
      <ModRow {mod} type="remote" />
    {/each}
    {#if $localOnlyMods.length > 0}
      <Table.Row>
        <Table.Cell
          class="text-start text-default pointer-events-none bg-slate-500/10"
        >
          <T keyName="local_mods" />
          ({$localOnlyMods.length})
        </Table.Cell>
        <Table.Cell class="text-end text-default bg-slate-500/10" colspan={2}>
          <button
            class="bg-primary text-white btn-primary ml-auto text-xs !p-1"
            disabled={processingMods.size > 0}
            onclick={async () => {
              await uploadAllMods($t);
            }}
            title={$t("sync_savegame")}
            aria-label={$t("sync_savegame")}
          >
            <T keyName="upload_all_mods" />
          </button>
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $localOnlyMods as mod (mod.modName)}
      <ModRow {mod} type="local" />
    {/each}
    {#if $syncedMods.length > 0}
      <Table.Row>
        <Table.Cell
          class="text-start text-default pointer-events-none bg-slate-500/10"
          colspan={3}
        >
          <T keyName="synced_mods" />
          ({$syncedMods.length})
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $syncedMods as mod (mod.modName + mod.version)}
      <ModRow {mod} type="sync" />
    {/each}
  </Table.Body>
</Table.Root>
