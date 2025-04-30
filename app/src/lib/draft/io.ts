// app/src/lib/draft/io.ts
import type { Draft } from '$lib/validate/model';

export function encodeDraft(d: Draft): string {
	return btoa(encodeURIComponent(JSON.stringify(d)));
}

export function decodeDraft(str: string): Draft | null {
	try {
		return JSON.parse(decodeURIComponent(atob(str))) as Draft;
	} catch {
		return null;
	}
}

