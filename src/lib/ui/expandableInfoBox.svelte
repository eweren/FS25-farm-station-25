<script lang="ts">
  import * as Alert from "$lib/components/ui/alert/index.js";

  import { slide } from "svelte/transition";

  export let show = false;
  export let title: string;
  export let description: string;
</script>

<Alert.Root class="text-left" onclick={() => (show = !show)}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    ><g fill="none"
      ><circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="1.5"
      /><path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
        d="M12 17v-6"
      /><circle
        cx="1"
        cy="1"
        r="1"
        fill="currentColor"
        transform="matrix(1 0 0 -1 11 9)"
      /></g
    ></svg
  >
  <Alert.Title class="cursor-pointer">
    {title}
  </Alert.Title>
  {#if show}
    <Alert.Description>
      <div transition:slide>
        {description}
      </div>
    </Alert.Description>
  {/if}
</Alert.Root>
