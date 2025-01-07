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
	import { cachedT } from "../lib/stores/gameStatus.store";
	import { onMount } from "svelte";

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

	onMount(() => {
		setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", (e) => {
				const newIsDark = e.matches;
				setTheme(newIsDark);
			});
	});

	const setTheme = (isDark: boolean) => {
		document.documentElement.classList.remove("dark");
		if (isDark) {
			document.documentElement.classList.add("dark");
		}
	};

	cachedT.set(tolgee.t);
</script>

<TolgeeProvider {tolgee}>
	<Toaster />
	<div slot="fallback">Loading...</div>

	{@render children()}
</TolgeeProvider>
