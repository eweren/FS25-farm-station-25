<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate, T } from "@tolgee/svelte";
  import {
    allLocalMods,
    remoteModsFromSavegames,
    otherRemoteMods,
    syncedMods,
  } from "../stores/savegamesAndMods.store";
  import { getDescriptionFromMod, getTitleFromMod } from "../sync/mods.sync";
  import {
    Render,
    Subscribe,
    createRender,
    createTable,
  } from "svelte-headless-table";

  import {
    addHiddenColumns,
    addPagination,
    addSelectedRows,
    addTableFilter,
  } from "svelte-headless-table/plugins";
  import { writable, get } from "svelte/store";
  import { Button } from "../components/ui/button";
  import { cn } from "../utils";
  import { Input } from "../components/ui/input";
  import ModSyncButton from "./modSyncButton.svelte";
  import type { Mod } from "../types/mod";
  import * as Tooltip from "$lib/components/ui/tooltip";

  const { t } = getTranslate();

  type EnhancedMod = Mod & {
    title: string;
    _description: string | null | undefined;
    location: "remote" | "local" | "both";
  };

  const data = writable<Array<EnhancedMod>>(
    [
      ...$otherRemoteMods.map(
        (r) => ({ ...r, location: "remote" }) as EnhancedMod,
      ),
      ...$allLocalMods.map((r) => ({ ...r, location: "local" }) as EnhancedMod),
      ...$syncedMods.map((r) => ({ ...r, location: "both" }) as EnhancedMod),
    ].map((e) => ({
      ...e,
      title: getTitleFromMod(e),
      _description: getDescriptionFromMod(e),
    })),
  );

  $effect(() => {
    data.set(
      [
        ...$otherRemoteMods.map(
          (r) => ({ ...r, location: "remote" }) as EnhancedMod,
        ),
        ...$allLocalMods.map(
          (r) => ({ ...r, location: "local" }) as EnhancedMod,
        ),
        ...$syncedMods.map((r) => ({ ...r, location: "both" }) as EnhancedMod),
      ].map((e) => ({
        ...e,
        title: getTitleFromMod(e),
        _description: getDescriptionFromMod(e),
      })),
    );

    table.data = data;
  });

  const table = createTable(data, {
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

  const columns = table.createColumns([
    table.column({
      id: "modName",
      header: "Mod Name",
      accessor: "modName",
      plugins: {
        hide: {},
        filter: {
          exclude: true,
        },
      },
    }),
    table.column({
      id: "title",
      header: $t("mod_name"),
      accessor: "title",
      plugins: {
        filter: {
          getFilterValue(value) {
            return value?.toLowerCase();
          },
        },
      },
    }),
    table.column({
      header: $t("mod_version"),
      accessor: "version",
      cell: ({ value }) => value.toLowerCase(),
      plugins: {
        filter: {
          getFilterValue(value) {
            return value.toLowerCase();
          },
        },
      },
    }),
    table.column({
      id: "description",
      header: $t("mod_description"),
      accessor: "_description",
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
          return createRender(ModSyncButton, {
            mod: data,
            type: value,
          });
        } else {
          return "";
        }
      },
    }),
  ]);

  const {
    headerRows,
    pageRows,
    tableAttrs,
    tableBodyAttrs,
    flatColumns,
    pluginStates,
    rows,
  } = table.createViewModel(columns, {
    rowDataId: (row) => row.filename + row.version,
  });

  const { hiddenColumnIds } = pluginStates.hide;

  const { hasNextPage, hasPreviousPage, pageIndex } = pluginStates.page;
  const { filterValue } = pluginStates.filter;

  const { selectedDataIds } = pluginStates.select;

  $effect(() => {
    $hiddenColumnIds = ["modName"];
  });
</script>

<div class="flex flex-col">
  <div class="flex items-center md:self-end py-4 self-stretch">
    <Input
      class="md:max-w-sm min-w-[40vw] w-full skew-x-0 h-10"
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
            <T keyName="no_mods" />
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
                          "text-left font-medium line-clamp-2 text-ellipsis",
                          cell.id === "title" && "min-w-[25vw] overflow-hidden",
                          cell.id === "status" && "overflow-visible",
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
