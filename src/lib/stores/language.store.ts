import { writable } from 'svelte/store';

/** Current language store */

export const currentLanguage = writable<string>('en');