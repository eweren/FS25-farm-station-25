<script lang="ts">
  import { getTranslate } from "@tolgee/svelte";

  import {
    processingAllMods,
    processingMods,
  } from "../stores/savegamesAndMods.store";
  import { downloadMod, uploadMod } from "../sync/mods.sync";
  import type { Mod } from "../types/mod";
  import * as Tooltip from "$lib/components/ui/tooltip";

  export let mod: Mod;

  export let type: "remote" | "local" | "both";

  const { t } = getTranslate();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    <button
      class="bg-primary text-white btn-primary aspect-square !p-2"
      disabled={processingMods.has(mod.modName) ||
        type === "both" ||
        $processingAllMods}
      onclick={async () => {
        processingMods.add(mod.modName);
        if (type === "local") {
          await uploadMod(mod, $t);
        } else if (type === "remote" && mod.remoteFileName) {
          await downloadMod(mod.remoteFileName, mod, $t);
        }
        processingMods.delete(mod.modName);
      }}
      aria-label={type === "both"
        ? $t("sync_mod")
        : type === "local"
          ? $t("upload_mod")
          : $t("download_mod")}
    >
      {#if processingMods.has(mod.modName)}
        <span
          class="solar--refresh-bold w-1 h-1 animate-[spin_1s_linear_reverse_infinite]"
        ></span>
      {:else if type === "both"}
        <span class="solar--check-circle-linear w-1 h-1"></span>
      {:else if type === "local"}
        <span class="solar--cloud-upload-outline w-1 h-1"></span>
      {:else if type === "remote"}
        <span class="solar--cloud-download-outline w-1 h-1"></span>
      {/if}
    </button>
  </Tooltip.Trigger>
  <Tooltip.Content>
    {type === "both"
      ? $t("sync_mod")
      : type === "local"
        ? $t("upload_mod")
        : $t("download_mod")}
  </Tooltip.Content>
</Tooltip.Root>
