import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

type FlyAndScaleParams = {
	y?: number;
	start?: number;
	duration?: number;
};

const defaultFlyAndScaleParams = { y: -8, start: 0.95, duration: 200 };

export function flyAndScale(node: Element, params?: FlyAndScaleParams): TransitionConfig {
	const style = getComputedStyle(node);
	const transform = style.transform === "none" ? "" : style.transform;
	const withDefaults = { ...defaultFlyAndScaleParams, ...params };

	const scaleConversion = (
		valueA: number,
		scaleA: [number, number],
		scaleB: [number, number]
	) => {
		const [minA, maxA] = scaleA;
		const [minB, maxB] = scaleB;

		const percentage = (valueA - minA) / (maxA - minA);
		const valueB = percentage * (maxB - minB) + minB;

		return valueB;
	};

	const styleToString = (style: Record<string, number | string | undefined>): string => {
		return Object.keys(style).reduce((str, key) => {
			if (style[key] === undefined) return str;
			return `${str}${key}:${style[key]};`;
		}, "");
	};

	return {
		duration: withDefaults.duration ?? 200,
		delay: 0,
		css: (t) => {
			const y = scaleConversion(t, [0, 1], [withDefaults.y, 0]);
			const scale = scaleConversion(t, [0, 1], [withDefaults.start, 1]);

			return styleToString({
				transform: `${transform} translate3d(0, ${y}px, 0) scale(${scale})`,
				opacity: t,
			});
		},
		easing: cubicOut,
	};
}

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const languagesToImportMap = (languages: string[]) => {
	const map: Record<string, () => void> = {};
	languages.forEach((lang) => {
		map[lang] = () => import(`../i18n/${lang}.json`);
	});
	return map;
}

export const availableLanguages = [
	"de",
	"cs",
	"en",
	"es",
	"fr",
	"nl",
	"ru",
	"uk",
	"it",
	"pl",
];

export const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);