<script>
  import { getTranslate, T } from "@tolgee/svelte";
  import { toast } from "svelte-sonner";

  export let code = "";

  function copyToClipboard() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success($t("copied"), {
          duration: 2000,
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  }

  const { t } = getTranslate();
</script>

<div class="flex flex-col items-start justify-start px-2">
  <T keyName="invite_code" />
  <button
    data-umami-event="copy_invite_code"
    title={$t("copy")}
    aria-label={$t("copy")}
    on:click={copyToClipboard}
    class="flex flex-row gap-4 justify-start items-center relative"
  >
    <code>{code}</code>

    <span class="solar--copy-linear"></span>
  </button>
</div>

<style>
  .solar--copy-linear {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23000' stroke-width='1.5'%3E%3Cpath d='M6 11c0-2.828 0-4.243.879-5.121C7.757 5 9.172 5 12 5h3c2.828 0 4.243 0 5.121.879C21 6.757 21 8.172 21 11v5c0 2.828 0 4.243-.879 5.121C19.243 22 17.828 22 15 22h-3c-2.828 0-4.243 0-5.121-.879C6 20.243 6 18.828 6 16z'/%3E%3Cpath d='M6 19a3 3 0 0 1-3-3v-6c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h4a3 3 0 0 1 3 3'/%3E%3C/g%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
