import { writable } from 'svelte/store';

export const currentLanguage = writable<string>('en');