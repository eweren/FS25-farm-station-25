<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate, T } from "@tolgee/svelte";
  import {
    localMods,
    localOnlySavegames,
    processingSavegames,
    remoteOnlySavegames,
    remoteSavegames,
    savegamesWithRemote,
  } from "../stores/savegames.store";
  import {
    downloadSavegame,
    syncSavegame,
    uploadSavegame,
  } from "../sync/utils";
  import SavegameTableRow from "./savegameTableRow.svelte";

  const { t } = getTranslate();

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  const playtimeFormatter = (playtime: number) => {
    const hours = Math.floor(playtime / 60);
    const minutes = Math.floor(playtime % 60);
    return `${hours}h ${minutes}m`;
  };
</script>

<Table.Root>
  <Table.Header>
    <Table.Row class="text-left pointer-events-none">
      <Table.Head>
        <T keyName="map" />
      </Table.Head>
      <Table.Head>
        <T keyName="info" /></Table.Head
      >
      <Table.Head>
        <T keyName="last_played" /></Table.Head
      >
      <Table.Head class="text-center">
        <T keyName="status" /></Table.Head
      >
    </Table.Row>
  </Table.Header>
  <Table.Body class="text-left text-primary">
    {#if $savegamesWithRemote.length > 0}
      <Table.Row>
        <Table.Cell
          colspan={4}
          class="text-start text-default pointer-events-none bg-slate-500/10"
        >
          <T keyName="synced_savegames" />
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $savegamesWithRemote as savegame}
      <SavegameTableRow {savegame} type="sync" />
    {/each}
    {#if $localOnlySavegames.length > 0}
      <Table.Row>
        <Table.Cell
          class="text-start text-default pointer-events-none bg-slate-500/10"
          colspan={4}
        >
          <T keyName="local_savegames" />
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $localOnlySavegames as savegame}
      <SavegameTableRow {savegame} type="local" />
    {/each}
    {#if $remoteOnlySavegames.length > 0}
      <Table.Row>
        <!-- Full width cell -->
        <Table.Cell
          colspan={4}
          class="text-start text-default pointer-events-none bg-slate-500/10"
        >
          <T keyName="remote_savegames" />
        </Table.Cell>
      </Table.Row>
    {/if}
    {#each $remoteOnlySavegames as remoteSavegameData}
      {@const savegame = remoteSavegameData.savegameInfo}
      <SavegameTableRow {savegame} type="remote" />
    {/each}
  </Table.Body>
</Table.Root>
