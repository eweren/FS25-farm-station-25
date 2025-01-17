<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { getTranslate, T } from "@tolgee/svelte";
  import type { Savegame } from "../types/savegame";
  import { processingSavegames } from "../stores/savegamesAndMods.store";
  import { syncSavegame } from "../sync/savegames.sync";
  import type { Mod } from "../types/mod";
  import { localMods } from "../stores/savegamesAndMods.store";
  import { error } from "@tauri-apps/plugin-log";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { updateSavegameName } from "../sync/utils";

  const { t } = getTranslate();

  export let savegame: (Omit<Savegame, "mods"> & { mods: number }) | Savegame;
  export let type: "sync" | "local" | "remote";

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

  const setSavegameName = async (eventTarget: EventTarget | null) => {
    const name = (eventTarget as HTMLInputElement)?.value.trim();
    if (name && name !== savegame.name && name !== "") {
      const res = await updateSavegameName(name, savegame.id);
      if (res != null) {
        location.reload();
      } else {
        alert("Failed to rename savegame");
      }
    }
  };
</script>

<Table.Row>
  <Table.Cell>
    <div class="flex flex-col items-start">
      <AlertDialog.Root>
        <AlertDialog.Trigger class="text-left" disabled={savegame.isRemote}>
          {savegame.name}
          ({$t("savegame_no", {
            number: savegame.id.replace("savegame", ""),
          })})
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title
              ><T keyName="rename_savegame" /></AlertDialog.Title
            >
            <AlertDialog.Description
              class="flex flex-col gap-4 items-center text-foreground"
            >
              <T keyName="rename_savegame_description" />

              <input
                type="text"
                class="p-2 max-w-xs"
                placeholder={$t("savegame_name")}
                value={savegame.name}
                onchange={(e) => {
                  setSavegameName(e.target);
                }}
              />
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer
            class="flex flex-row justify-center items-center gap-4"
          >
            <AlertDialog.Cancel>
              <T keyName="cancel" />
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <T keyName="rename" />
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
      <span class="text-foreground">{savegame.map}</span>
    </div>
  </Table.Cell>
  <Table.Cell>
    <div class="flex flex-col items-start">
      <span title="">
        {typeof savegame.mods === "number"
          ? $t("mods_no", {
              number: savegame.mods,
            })
          : $t("mods_no_compare", {
              local: $localMods
                .keys()
                .filter((localMod) =>
                  (savegame.mods as Array<Mod>).some(
                    (m) => m.modName + m.version === localMod,
                  ),
                )
                .toArray().length,
              number:
                savegame.mods != null
                  ? (savegame.mods as Array<Mod>).length
                  : 0,
            })}
      </span>
      <span class="text-foreground">
        {$t("players_no", {
          number: savegame.farms.reduce(
            (prev, f) => prev + (f.players?.length ?? 0),
            0,
          ),
        })}
      </span>
    </div>
  </Table.Cell>
  <Table.Cell class="text-center flex flex-col items-start">
    <span>{dateFormatter.format(new Date(savegame.saveDate))}</span>
    <span class="text-foreground">{playtimeFormatter(savegame.playTime)}</span>
  </Table.Cell>
  <Table.Cell class="text-center">
    <button
      class="bg-primary text-white btn-primary"
      disabled={processingSavegames.size > 0}
      onclick={async () => {
        processingSavegames.add(savegame.id);
        try {
          await syncSavegame(savegame as Savegame, $t);
        } catch (e) {
          error(`Failed to sync savegame ${e}`);
        } finally {
          processingSavegames.delete(savegame.id);
        }
      }}
      title={$t("sync_savegame")}
      aria-label={$t("sync_savegame")}
    >
      {#if processingSavegames.has(savegame.id)}
        <span
          class="solar--refresh-bold w-1 h-1 animate-[spin_1s_linear_reverse_infinite]"
        ></span>
      {:else if type === "sync"}
        <span class="solar--refresh-bold w-1 h-1"></span>
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
