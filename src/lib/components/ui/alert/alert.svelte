<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { type Variant, alertVariants } from "./index.js";
	import { cn } from "$lib/utils.js";

	type $$Props = HTMLAttributes<HTMLButtonElement> & {
		variant?: Variant;
	};

	let className: $$Props["class"] = undefined;
	export let variant: $$Props["variant"] = "default";
	export { className as class };
</script>

<button
	type="button"
	class={cn(alertVariants({ variant }), className)}
	{...$$restProps}
>
	<slot />
</button>
