<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { getTranslate, T } from "@tolgee/svelte";
  import { otherPlayers } from "../stores/playersStatus.store";
  import { startGame } from "../sync/utils";
  import { toast } from "svelte-sonner";

  export let isOpen = false;

  const { t } = getTranslate();

  const start = async () => {
    toast($t("start_game_status_starting"));
    await startGame();
  };

  const formatter = new Intl.ListFormat(undefined, {
    style: "long",
    type: "conjunction",
  });
</script>

<AlertDialog.Root bind:open={isOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        <T keyName="other_players_playing" />
      </AlertDialog.Title>
      <AlertDialog.Description class="text-foreground">
        <div class="my-4 text-lg">
          {formatter.format($otherPlayers)}
        </div>
        <T keyName="other_players_playing_description_end" />
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel><T keyName="cancel" /></AlertDialog.Cancel>
      <AlertDialog.Action onclick={start}
        ><T keyName="ignore_other_players" /></AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
