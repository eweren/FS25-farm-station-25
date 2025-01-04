<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import {
    config,
    localSavegames,
    remoteSavegames,
  } from "../stores/savegames.store";
  import {
    downloadSavegame,
    getSavegamesFromRemote,
    syncSavegame,
    uploadSavegame,
  } from "../sync/utils";

  $: savegamesWithRemote = $localSavegames.filter(
    (savegame) =>
      $config.savegameMapping[savegame.id] != null &&
      $remoteSavegames.some(
        (s) => s.key === $config.savegameMapping[savegame.id],
      ),
  );
  $: localOnlySavegames = $localSavegames.filter(
    (savegame) =>
      $config.savegameMapping[savegame.id] == null ||
      !$remoteSavegames.some(
        (s) => s.key === $config.savegameMapping[savegame.id],
      ),
  );

  $: remoteOnlySavegames = $remoteSavegames.filter(
    (savegame) =>
      !Object.values($config.savegameMapping).includes(savegame.key),
  );

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

  let processingSavegames = new Set<string>();
</script>

<Table.Root>
  <Table.Header>
    <Table.Row class="text-left pointer-events-none">
      <Table.Head class="min-w-[100px]">Karte</Table.Head>
      <Table.Head>Spieler</Table.Head>
      <Table.Head>Zuletzt</Table.Head>
      <Table.Head>Spielzeit</Table.Head>
      <Table.Head class="text-center">Status</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body class="text-left text-primary">
    {#if savegamesWithRemote.length > 0}
      <Table.Row>
        <Table.Cell class="text-start text-default pointer-events-none"
          >Synchronisierte Spielstände</Table.Cell
        >
      </Table.Row>
    {/if}
    {#each savegamesWithRemote as savegame}
      <Table.Row>
        <Table.Cell>{savegame.map}</Table.Cell>
        <Table.Cell
          >{savegame.farms.reduce(
            (prev, f) => prev + f.players.length,
            0,
          )}</Table.Cell
        >
        <Table.Cell>
          {dateFormatter.format(new Date(savegame.saveDate))}
        </Table.Cell>
        <Table.Cell>{playtimeFormatter(savegame.playTime)}</Table.Cell>
        <Table.Cell class="text-center">
          <button
            class="bg-primary text-white p-2"
            disabled={processingSavegames.has(savegame.id)}
            onclick={async () => {
              processingSavegames.add(savegame.id);
              processingSavegames = new Set(processingSavegames);
              await syncSavegame(savegame, $remoteSavegames, $config);
              remoteSavegames.set(await getSavegamesFromRemote());
              processingSavegames.delete(savegame.id);
              processingSavegames = new Set(processingSavegames);
            }}
            title="Spielstand synchronisieren"
            aria-label="Spielstand synchronisieren"
          >
            <span class="solar--refresh-bold w-1 h-1"></span>
          </button>
        </Table.Cell>
      </Table.Row>
    {/each}
    {#if localOnlySavegames.length > 0}
      <Table.Row>
        <Table.Cell
          class="text-start text-default pointer-events-none"
          colspan={5}
        >
          Lokale Spielstände</Table.Cell
        >
      </Table.Row>
    {/if}
    {#each localOnlySavegames as savegame}
      <Table.Row>
        <Table.Cell>{savegame.map}</Table.Cell>
        <Table.Cell
          >{savegame.farms.reduce(
            (prev, f) => prev + f.players.length,
            0,
          )}</Table.Cell
        >
        <Table.Cell>
          {dateFormatter.format(new Date(savegame.saveDate))}
        </Table.Cell>
        <Table.Cell>{playtimeFormatter(savegame.playTime)}</Table.Cell>
        <Table.Cell class="text-center">
          <button
            disabled={processingSavegames.has(savegame.id)}
            onclick={async () => {
              processingSavegames.add(savegame.id);
              processingSavegames = new Set(processingSavegames);
              await uploadSavegame(savegame, $remoteSavegames, $config);
              remoteSavegames.set(await getSavegamesFromRemote());
              console.log($remoteSavegames);
              processingSavegames.delete(savegame.id);
              processingSavegames = new Set(processingSavegames);
            }}
            class="bg-primary text-white p-2"
            title="Spielstand hochladen"
            aria-label="Spielstand hochladen"
          >
            <span class="solar--cloud-upload-outline w-1 h-1"></span>
          </button>
        </Table.Cell>
      </Table.Row>
    {/each}
    {#if remoteOnlySavegames.length > 0}
      <Table.Row>
        <!-- Full width cell -->
        <Table.Cell
          colspan={5}
          class="text-start text-default pointer-events-none"
        >
          Remote Spielstände</Table.Cell
        >
      </Table.Row>
    {/if}
    {#each remoteOnlySavegames as remoteSavegameData}
      {@const remoteSavegame = remoteSavegameData.savegameInfo}
      <Table.Row>
        <Table.Cell>{remoteSavegame.map}</Table.Cell>
        <Table.Cell
          >{remoteSavegame.farms.reduce(
            (prev, f) => prev + f.players.length,
            0,
          )}</Table.Cell
        >
        <Table.Cell>
          {dateFormatter.format(new Date(remoteSavegame.saveDate))}
        </Table.Cell>
        <Table.Cell>{playtimeFormatter(remoteSavegame.playTime)}</Table.Cell>
        <Table.Cell class="text-center">
          <button
            class="bg-primary text-white p-2"
            disabled={processingSavegames.has(remoteSavegameData.key)}
            onclick={async () => {
              processingSavegames.add(remoteSavegameData.key);
              processingSavegames = new Set(processingSavegames);
              await downloadSavegame(
                remoteSavegameData.key,
                $localSavegames,
                $config,
              );
              remoteSavegames.set(await getSavegamesFromRemote());
              processingSavegames.delete(remoteSavegameData.key);
              processingSavegames = new Set(processingSavegames);
            }}
            title="Spielstand synchronisieren"
            aria-label="Spielstand synchronisieren"
          >
            <span class="solar--cloud-download-outline w-1 h-1"></span>
          </button>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<style>
  .solar--cloud-upload-outline {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' fill-rule='evenodd' d='M11.47 15.47a.75.75 0 0 1 1.06 0l2 2a.75.75 0 1 1-1.06 1.06l-.72-.72V22a.75.75 0 0 1-1.5 0v-4.19l-.72.72a.75.75 0 1 1-1.06-1.06z' clip-rule='evenodd'/%3E%3Cpath fill='%23000' d='M12.476 3.75c-2.75 0-4.964 2.2-4.964 4.897c0 .462.065.909.185 1.331c.497.144.963.36 1.383.64a.75.75 0 1 1-.827 1.25a3.54 3.54 0 0 0-1.967-.589c-1.961 0-3.536 1.57-3.536 3.486s1.575 3.485 3.536 3.485a.75.75 0 0 1 0 1.5c-2.773 0-5.036-2.224-5.036-4.985c0-2.705 2.17-4.893 4.864-4.983a6.4 6.4 0 0 1-.102-1.135c0-3.541 2.902-6.397 6.464-6.397c3.158 0 5.796 2.244 6.355 5.221c2.3.977 3.919 3.238 3.919 5.882c0 3.074-2.188 5.631-5.093 6.253a.75.75 0 0 1-.314-1.467c2.24-.48 3.907-2.446 3.907-4.786c0-2.137-1.39-3.962-3.338-4.628a5 5 0 0 0-1.626-.27c-.583 0-1.14.1-1.658.28a.75.75 0 0 1-.494-1.416a6.5 6.5 0 0 1 3.024-.305a4.96 4.96 0 0 0-4.682-3.264'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .solar--cloud-download-outline {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' fill-rule='evenodd' d='M12 15.25a.75.75 0 0 1 .75.75v4.19l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l.72.72V16a.75.75 0 0 1 .75-.75' clip-rule='evenodd'/%3E%3Cpath fill='%23000' d='M12.226 3.5c-2.75 0-4.964 2.2-4.964 4.897c0 .462.065.909.185 1.331c.497.144.963.36 1.383.64a.75.75 0 1 1-.827 1.25a3.54 3.54 0 0 0-1.967-.589c-1.961 0-3.536 1.57-3.536 3.486S4.075 18 6.036 18a.75.75 0 0 1 0 1.5C3.263 19.5 1 17.276 1 14.515c0-2.705 2.17-4.893 4.864-4.983a6.4 6.4 0 0 1-.102-1.135C5.762 4.856 8.664 2 12.226 2c3.158 0 5.796 2.244 6.355 5.221c2.3.977 3.919 3.238 3.919 5.882c0 3.074-2.188 5.631-5.093 6.253a.75.75 0 0 1-.314-1.467c2.24-.48 3.907-2.446 3.907-4.786c0-2.137-1.39-3.962-3.338-4.628a5 5 0 0 0-1.626-.27c-.583 0-1.14.1-1.658.28a.75.75 0 0 1-.494-1.416a6.5 6.5 0 0 1 3.024-.305A4.96 4.96 0 0 0 12.226 3.5'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
