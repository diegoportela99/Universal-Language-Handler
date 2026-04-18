import * as https from 'https';
import { LANGUAGE_CODES } from './languages';

export interface TranslationRequest {
	text: string;
	type: 'comment' | 'identifier';
}

export interface ITranslator {
	translateBatch(requests: TranslationRequest[], targetLanguage: string): Promise<string[]>;
}

// ── Identifier helpers ────────────────────────────────────────────────────────

type IdentifierStyle = 'camel' | 'pascal' | 'snake' | 'other';

function splitIdentifier(name: string): { words: string[]; style: IdentifierStyle } {
	if (name.includes('_')) {
		return { words: name.split('_').filter(Boolean), style: 'snake' };
	}
	const isPascal = /^[A-Z]/.test(name);
	const words = name
		.replace(/([A-Z])/g, ' $1')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());
	return { words, style: isPascal ? 'pascal' : 'camel' };
}

function capitalize(w: string): string {
	return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function joinIdentifier(words: string[], style: IdentifierStyle): string {
	if (!words.length) { return ''; }

	// Non-Latin scripts (CJK, Arabic, Cyrillic, etc.): concatenate without separators
	const hasNonLatin = words.some((w) => /[^\x00-\x7F]/.test(w));
	if (hasNonLatin) {
		return words.join('');
	}

	const clean = words
		.map((w) => w.replace(/[^a-z0-9]/gi, '').toLowerCase())
		.filter(Boolean);
	if (!clean.length) { return words.join(''); }

	if (style === 'snake')  { return clean.join('_'); }
	if (style === 'pascal') { return clean.map(capitalize).join(''); }
	// camelCase
	return clean[0] + clean.slice(1).map(capitalize).join('');
}

// ── Google Translate free endpoint (no API key required) ─────────────────────

function googleTranslate(text: string, to: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const url =
			'https://translate.googleapis.com/translate_a/single' +
			`?client=gtx&sl=auto&tl=${encodeURIComponent(to)}` +
			`&dt=t&q=${encodeURIComponent(text)}`;

		https
			.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
				let raw = '';
				res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
				res.on('end', () => {
					try {
						const parsed = JSON.parse(raw) as [Array<[string, string]>];
						const result = parsed[0].map((part) => part[0]).join('');
						resolve(result);
					} catch {
						reject(new Error('Could not parse translation response'));
					}
				});
			})
			.on('error', (err) => reject(new Error(`Translation request failed: ${err.message}`)));
	});
}

// ── FreeTranslator ────────────────────────────────────────────────────────────

export class FreeTranslator implements ITranslator {
	async translateBatch(requests: TranslationRequest[], targetLanguage: string): Promise<string[]> {
		if (requests.length === 0) { return []; }

		const langCode = (LANGUAGE_CODES as Record<string, string>)[targetLanguage] ?? 'es';

		// Prepare: split camelCase/snake_case identifiers into space-separated words
		// so Google Translate understands each word individually.
		const styles: Array<IdentifierStyle | null> = [];
		const texts = requests.map((r, i) => {
			if (r.type === 'identifier') {
				const { words, style } = splitIdentifier(r.text);
				styles[i] = style;
				return words.join(' ');
			}
			styles[i] = null;
			return r.text;
		});

		// One HTTP call: batch via newlines (Google Translate preserves them).
		const translated = await googleTranslate(texts.join('\n'), langCode);
		const parts = translated.split('\n');

		return requests.map((r, i) => {
			const raw = (parts[i] ?? r.text).trim();
			const style = styles[i];
			if (style !== null) {
				return joinIdentifier(raw.split(/\s+/).filter(Boolean), style);
			}
			return raw;
		});
	}
}

// ── MockTranslator (used in tests) ────────────────────────────────────────────

export class MockTranslator implements ITranslator {
	private readonly translations: Map<string, string>;

	constructor(translations: Map<string, string> = new Map()) {
		this.translations = translations;
	}

	async translateBatch(requests: TranslationRequest[], _targetLanguage: string): Promise<string[]> {
		return requests.map((r) => this.translations.get(r.text) ?? `${r.text}_translated`);
	}
}
