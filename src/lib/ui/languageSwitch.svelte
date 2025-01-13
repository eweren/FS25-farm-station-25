<script lang="ts">
  import { getTolgee, T } from "@tolgee/svelte";
  import { slide } from "svelte/transition";
  import { onMount } from "svelte";
  import { saveConfig } from "../sync/utils";
  import { config } from "../stores/config.store";

  const tolgee = getTolgee();

  let currentLanguage = tolgee.value.getLanguage() ?? "de";

  function setCurrentLanguage(lang: string) {
    saveConfig({ ...$config, lang });
    tolgee.value.changeLanguage(lang);
    showDropdown = false;
  }

  $: {
    if ($config.lang && $config.lang !== currentLanguage) {
      currentLanguage = $config.lang;
      setCurrentLanguage($config.lang);
    }
  }

  onMount(() => {
    tolgee.subscribe((value) => {
      currentLanguage = value.getLanguage() ?? "de";
    });
  });

  let showDropdown = false;
</script>

<div class="dropdown">
  <button onclick={() => (showDropdown = !showDropdown)}>
    <T keyName={currentLanguage} />
  </button>
  {#if showDropdown}
    <div transition:slide={{ duration: 100 }} class="dropdown-content">
      <button onclick={() => setCurrentLanguage("en")}>
        <T keyName="en" />
      </button>
      <button onclick={() => setCurrentLanguage("de")}>
        <T keyName="de" />
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-content {
    @apply rounded absolute right-0 translate-x-1/2 top-full mt-2 flex flex-col gap-1 border border-gray-300 z-10 items-stretch;
  }

  .dropdown-content button {
    padding: 0.5rem;
    text-align: left;
    text-decoration: none;
    display: block;
  }

  .dropdown-content button:hover {
    background-color: var(--fs-color-primary);
  }
</style>
