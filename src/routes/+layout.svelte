<script lang="ts">
	import "../app.css";
	import en from "../i18n/en.json";
	import {
		TolgeeProvider,
		Tolgee,
		DevTools,
		FormatSimple,
	} from "@tolgee/svelte";
	import { Toaster } from "$lib/components/ui/sonner";
	import { cachedT } from "../lib/stores/gameStatus.store";
	import { onMount } from "svelte";
	import { updateApp } from "../lib/updater";
	import { availableLanguages, languagesToImportMap } from "../lib/utils";

	let { children } = $props();

	const tolgee = Tolgee()
		.use(DevTools())
		.use(FormatSimple())
		.init({
			defaultLanguage: "en",
			availableLanguages,
			staticData: {
				...languagesToImportMap(availableLanguages.filter((l) => l !== "en")),
				en,
			},
		});

	onMount(async () => {
		setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", (e) => {
				const newIsDark = e.matches;
				setTheme(newIsDark);
			});

		setTimeout(async () => {
			await updateApp(tolgee.t);
		}, 5000);
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
