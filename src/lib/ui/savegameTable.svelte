<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate, T } from "@tolgee/svelte";
  import {
    savegamesWithRemote,
    localOnlySavegames,
    remoteOnlySavegames,
    localMods,
    remoteSavegames,
  } from "../stores/savegamesAndMods.store";
  import {
    Render,
    Subscribe,
    createRender,
    createTable,
    type Constructor,
  } from "svelte-headless-table";

  import {
    addHiddenColumns,
    addPagination,
    addSelectedRows,
    addSortBy,
    addTableFilter,
  } from "svelte-headless-table/plugins";
  import { writable, get } from "svelte/store";
  import { Button } from "../components/ui/button";
  import { cn } from "../utils";
  import { Input } from "../components/ui/input";
  import type { Mod } from "../types/mod";
  import * as Tooltip from "$lib/components/ui/tooltip";

  import type { EnhancedSavegame } from "../types/listObjectResponse";
  import { config } from "../stores/config.store";
  import SavegameSyncButton from "./savegameSyncButton.svelte";
  import type { SvelteComponent } from "svelte";

  const { t } = getTranslate();

  const data = writable<Array<EnhancedSavegame>>([
    ...$savegamesWithRemote.map(
      (r) => ({ ...r, location: "both" }) as EnhancedSavegame,
    ),
    ...$localOnlySavegames.map(
      (r) => ({ ...r, location: "local" }) as EnhancedSavegame,
    ),
    ...$remoteOnlySavegames.map(
      (r) =>
        ({
          ...r.savegameInfo,
          info: { key: r.key, size: r.size, uploaded: r.uploaded },
          location: "remote",
        }) as EnhancedSavegame,
    ),
  ]);

  $effect(() => {
    data.set([
      ...$savegamesWithRemote.map(
        (r) => ({ ...r, location: "both" }) as EnhancedSavegame,
      ),
      ...$localOnlySavegames.map(
        (r) => ({ ...r, location: "local" }) as EnhancedSavegame,
      ),
      ...$remoteOnlySavegames.map(
        (r) =>
          ({
            ...r.savegameInfo,
            info: { key: r.key, size: r.size, uploaded: r.uploaded },
            location: "remote",
          }) as EnhancedSavegame,
      ),
    ]);

    table.data = data;
  });

  const table = createTable(data, {
    sort: addSortBy({ disableMultiSort: true }),
    page: addPagination(),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => {
        return value.toLowerCase().includes(filterValue.toLowerCase());
      },
    }),
    select: addSelectedRows(),
    hide: addHiddenColumns({
      initialHiddenColumnIds: ["modName"],
    }),
  });

  const columns = $derived(
    table.createColumns([
      table.column({
        id: "id",
        header: $t("savegame_id"),
        accessor: "id",
        plugins: {
          filter: {
            getFilterValue(value) {
              return value?.toLowerCase();
            },
          },
        },
      }),
      table.column({
        id: "name",
        header: $t("savegame_name"),
        accessor: "name",
        plugins: {
          filter: {
            getFilterValue(value) {
              return value?.toLowerCase();
            },
          },
        },
      }),
      table.column({
        id: "map",
        header: $t("map"),
        accessor: "map",
        plugins: {
          hide: {},
          sort: {
            disable: true,
          },
          filter: {
            exclude: true,
          },
        },
      }),
      table.column({
        id: "mods",
        header: $t("mods"),
        accessor: "mods",
        cell: ({ value }) => {
          return typeof value === "number"
            ? $t("mods_no", {
                number: value,
              })
            : $t("mods_no_compare", {
                local: $localMods
                  .keys()
                  .filter((localMod) =>
                    (value as Array<Mod>).some(
                      (m) => m.modName + m.version === localMod,
                    ),
                  )
                  .toArray().length,
                number: value != null ? (value as Array<Mod>).length : 0,
              });
        },
        plugins: {
          sort: {
            disable: true,
          },
          filter: {
            exclude: true,
          },
        },
      }),
      table.column({
        header: $t("game_time"),
        accessor: "id",
        id: "playtime",
        cell: ({ value }) => {
          const savegame = $data.find((r) => r.id === value);

          if (savegame?.id == null) {
            return "";
          }

          const remoteKey = $config.savegameMapping[savegame?.id];

          const remoteSavegame = $remoteSavegames.find(
            (r) => r.key === remoteKey,
          );

          const formatted = (playtime: number) => {
            const hours = Math.floor(playtime / 60);
            const minutes = Math.floor(playtime % 60);
            return `${hours}h ${minutes}m`;
          };
          return $t("playtime_entry", {
            local: formatted(savegame?.playTime ?? 0),
            remote: formatted(remoteSavegame?.savegameInfo.playTime ?? 0),
          });
        },
        plugins: {
          filter: {
            exclude: true,
          },
        },
      }),
      table.column({
        header: $t("farms"),
        accessor: "farms",
        cell: ({ value }) => {
          const formatter = new Intl.NumberFormat(get(config).lang ?? "en-US", {
            style: "currency",
            currency: "EUR",
          });

          return value
            .map(
              (f) =>
                f.name + ` (${formatter.format(parseFloat(f.money ?? "0"))})`,
            )
            .join(",\n");
        },
        plugins: {
          filter: {
            exclude: true,
          },
        },
      }),
      table.column({
        id: "status",
        header: $t("status"),
        accessor: "location",
        cell: ({ value, row }) => {
          const data = row.isData() ? row.original : null;
          if (data) {
            return createRender(
              SavegameSyncButton as unknown as Constructor<SvelteComponent>,
              {
                savegame: data,
                type: value,
              },
            );
          } else {
            return "";
          }
        },
      }),
    ]),
  );

  const {
    headerRows,
    pageRows,
    tableAttrs,
    tableBodyAttrs,
    flatColumns,
    pluginStates,
    rows,
  } = $derived(
    table.createViewModel(columns, {
      rowDataId: (row) => row.id,
    }),
  );

  const { hiddenColumnIds } = $derived(pluginStates.hide);

  const { hasNextPage, hasPreviousPage, pageIndex } = $derived(
    pluginStates.page,
  );
  const { filterValue } = $derived(pluginStates.filter);

  const { selectedDataIds } = $derived(pluginStates.select);

  $effect(() => {
    $hiddenColumnIds = ["modName"];
  });
</script>

<div class="flex flex-col">
  <div class="flex items-center md:self-end py-4 self-stretch">
    <Input
      class="md:max-w-sm min-w-[40vw] w-full skew-x-0 h-10 overflow-visible"
      placeholder={$t("search")}
      type="text"
      bind:value={$filterValue}
    />
  </div>
  <div class="rounded-md border">
    <Table.Root {...$tableAttrs}>
      <Table.Header>
        {#each $headerRows as headerRow}
          <Subscribe rowAttrs={headerRow.attrs()}>
            <Table.Row>
              {#each headerRow.cells as cell (cell.id)}
                <Subscribe
                  attrs={cell.attrs()}
                  let:attrs
                  props={cell.props()}
                  let:props
                >
                  <Table.Head
                    {...attrs}
                    class={cn(
                      "[&:has([role=checkbox])]:pl-3",
                      cell.id === "status" && "sr-only",
                    )}
                  >
                    <Render of={cell.render()} />
                  </Table.Head>
                </Subscribe>
              {/each}
            </Table.Row>
          </Subscribe>
        {/each}
      </Table.Header>
      <Table.Body {...$tableBodyAttrs}>
        {#if $pageRows.length === 0}
          <Table.Cell colspan={flatColumns.length} class="text-center">
            <T keyName="no_savegames" />
          </Table.Cell>
        {/if}
        {#each $pageRows as row (row.id)}
          <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
            <Table.Row
              {...rowAttrs}
              data-state={$selectedDataIds[row.id] && "selected"}
            >
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell
                    class={cn(
                      "[&:has([role=checkbox])]:pl-3 last:pl-5 last:sticky last:right-0 text-left",
                      cell.id === "status" &&
                        "sync-col h-full !pl-3 from-transparent via-background to-background bg-gradient-to-r",
                    )}
                    {...attrs}
                  >
                    {#if cell.id === "description"}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          <div
                            class={cn(
                              "text-left font-medium line-clamp-2 text-ellipsis text-xs overflow-hidden whitespace-pre-wrap",
                            )}
                          >
                            <Render of={cell.render()} />
                          </div>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <div class="whitespace-pre-wrap">
                            {cell.render().toString()}
                          </div>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {:else}
                      <div
                        class={cn(
                          "text-left font-medium line-clamp-2 text-ellipsis whitespace-pre-wrap",
                          cell.id === "name" && "min-w-[120px] overflow-hidden",
                          cell.id === "status" && "overflow-visible",
                          cell.id === "playtime" && "min-w-[120px]",
                        )}
                      >
                        <Render of={cell.render()} />
                      </div>
                    {/if}
                  </Table.Cell>
                </Subscribe>
              {/each}
            </Table.Row>
          </Subscribe>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <div class="flex items-center justify-end space-x-4 py-4">
    {#if $hasPreviousPage}
      <Button
        variant="outline"
        size="sm"
        on:click={() => ($pageIndex = $pageIndex - 1)}
        disabled={!$hasPreviousPage}
      >
        <T keyName="previous_page" />
      </Button>
    {/if}
    {#if $hasNextPage}
      <Button
        variant="outline"
        size="sm"
        disabled={!$hasNextPage}
        on:click={() => ($pageIndex = $pageIndex + 1)}
      >
        <T keyName="next_page" />
      </Button>
    {/if}
  </div>
</div>
