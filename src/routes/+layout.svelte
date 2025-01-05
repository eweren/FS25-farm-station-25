<script lang="ts">
	import "../app.css";
	import de from "../i18n/de.json";
	import {
		TolgeeProvider,
		Tolgee,
		DevTools,
		FormatSimple,
	} from "@tolgee/svelte";
	import { Toaster } from "$lib/components/ui/sonner";

	let { children } = $props();

	const tolgee = Tolgee()
		.use(DevTools())
		.use(FormatSimple())
		.init({
			language: "de",
			defaultLanguage: "de",
			availableLanguages: ["de", "en"],
			staticData: {
				de,
				en: () => import("../i18n/en.json"),
			},
		});
</script>

<TolgeeProvider {tolgee}>
	<Toaster />
	<div slot="fallback">Loading...</div>

	{@render children()}
</TolgeeProvider>
