<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { localSavegames } from "../stores/savegamesAndMods.store";
  import { getTranslate, T } from "@tolgee/svelte";
  import Button from "../components/ui/button/button.svelte";

  const { onSelectionChange, onCancel } = $props<{
    onSelectionChange: (savegame: string | null) => void;
    onCancel: () => void;
  }>();

  let selectedSavegame = $state<string | null>(null);

  function selectSavegame(savegame: string | null) {
    selectedSavegame = savegame;
    if (savegame) {
      showConfirm = true;
    } else {
      onSelectionChange(null);
      showConfirm = false;
    }
  }

  let showConfirm = $state(false);

  const { t } = getTranslate();
</script>

<Dialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) {
      onCancel();
    }
  }}
>
  <Dialog.Overlay />
  <Dialog.Content>
    <Dialog.Title>
      {#if showConfirm}
        <T keyName="override_confirm_title" />
      {:else}
        <T keyName="where_to_save_title" />
      {/if}
    </Dialog.Title>
    <Dialog.Description>
      {#if showConfirm}
        {@html $t("override_confirm", {
          text: `${$localSavegames.find((s) => s.id === selectedSavegame)?.name ?? ""} (${selectedSavegame})`,
        })}
      {:else}
        <T keyName="where_to_save_description" />
      {/if}
      <!-- TODO: add options to either return to selection or confirm the selection -->
    </Dialog.Description>

    {#if showConfirm}
      <div class="flex gap-2">
        <Button
          class="flex-1"
          variant="ghost"
          on:click={() => {
            selectedSavegame = null;
            showConfirm = false;
          }}
        >
          <T keyName="back" />
        </Button>
        <Button
          class="flex-1"
          variant="default"
          on:click={() => {
            onSelectionChange(selectedSavegame);
          }}
        >
          <T keyName="yes" />
        </Button>
      </div>
    {:else}
      <div class="flex flex-col gap-2 mt-4">
        <Button on:click={() => selectSavegame(null)}>
          <T keyName="new_savegame" />
        </Button>
        {#each $localSavegames as savegame}
          <Button
            variant="outline"
            on:click={() => selectSavegame(savegame.id)}
          >
            {savegame.name} ({savegame.id})
          </Button>
        {/each}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
