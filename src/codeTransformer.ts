import { ITranslator, TranslationRequest } from './translator';

export interface TransformOptions {
	translateComments: boolean;
	translateIdentifiers: boolean;
}

interface CommentElement {
	/** The text content to translate (without delimiters) */
	text: string;
	/** Regex matching the full comment in the source so replacements can be applied */
	pattern: RegExp;
	type: 'single' | 'multi' | 'hash';
}

// Identifiers we never translate — language keywords and single-letter vars
const IDENTIFIER_BLOCKLIST = new Set([
	'abstract', 'activate', 'any', 'as', 'async', 'await',
	'boolean', 'break',
	'case', 'catch', 'class', 'const', 'constructor', 'continue',
	'declare', 'default', 'delete', 'deactivate', 'do',
	'else', 'enum', 'entries', 'export', 'extends',
	'false', 'filter', 'finally', 'for', 'forEach', 'from', 'function',
	'get', 'global',
	'has',
	'if', 'implements', 'import', 'in', 'index', 'instanceof', 'interface',
	'keys',
	'length', 'let',
	'main', 'map', 'module',
	'namespace', 'new', 'null',
	'of',
	'pop', 'private', 'protected', 'public', 'push',
	'readonly', 'reduce', 'return',
	'set', 'shift', 'size', 'static', 'string', 'super', 'switch',
	'this', 'throw', 'true', 'try', 'type', 'typeof',
	'undefined',
	'values', 'var', 'void',
	'while',
]);

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractComments(code: string): CommentElement[] {
	const elements: CommentElement[] = [];
	const seen = new Set<string>();

	// Single-line // comments
	const singleRe = /\/\/([^\n]+)/g;
	let m: RegExpExecArray | null;
	while ((m = singleRe.exec(code)) !== null) {
		const text = m[1].trim();
		if (text && !seen.has(text)) {
			seen.add(text);
			elements.push({
				text,
				pattern: new RegExp(`\\/\\/${escapeRegex(m[1])}`, 'g'),
				type: 'single',
			});
		}
	}

	// Multi-line /* ... */ comments
	const multiRe = /\/\*([\s\S]*?)\*\//g;
	while ((m = multiRe.exec(code)) !== null) {
		const text = m[1].trim();
		if (text && !seen.has(text)) {
			seen.add(text);
			elements.push({
				text,
				pattern: new RegExp(`\\/\\*${escapeRegex(m[1])}\\*\\/`, 'g'),
				type: 'multi',
			});
		}
	}

	// Hash # comments (Python, Shell, Ruby, etc.)
	const hashRe = /#([^\n!]{1}[^\n]*)/g;
	while ((m = hashRe.exec(code)) !== null) {
		const text = m[1].trim();
		if (text && !seen.has(text)) {
			seen.add(text);
			elements.push({
				text,
				pattern: new RegExp(`#${escapeRegex(m[1])}`, 'g'),
				type: 'hash',
			});
		}
	}

	return elements;
}

function extractDeclaredIdentifiers(code: string): string[] {
	const found = new Set<string>();
	let m: RegExpExecArray | null;

	// function declarations and expressions: function name(
	const funcRe = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
	while ((m = funcRe.exec(code)) !== null) { found.add(m[1]); }

	// const/let/var assignments (arrow functions and plain variables)
	const varRe = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
	while ((m = varRe.exec(code)) !== null) { found.add(m[1]); }

	// class declarations
	const classRe = /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
	while ((m = classRe.exec(code)) !== null) { found.add(m[1]); }

	// method-like definitions (2+ spaces indent then name followed by open paren)
	const methodRe = /^\s{2,}([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
	while ((m = methodRe.exec(code)) !== null) { found.add(m[1]); }

	// Python-style def
	const defRe = /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g;
	while ((m = defRe.exec(code)) !== null) { found.add(m[1]); }

	return Array.from(found).filter(
		(id) => id.length >= 2 && !IDENTIFIER_BLOCKLIST.has(id)
	);
}

export async function transformCode(
	code: string,
	targetLanguage: string,
	translator: ITranslator,
	options: TransformOptions = { translateComments: true, translateIdentifiers: true }
): Promise<string> {
	const requests: TranslationRequest[] = [];
	const commentElements: CommentElement[] = [];
	const identifierNames: string[] = [];

	if (options.translateComments) {
		const comments = extractComments(code);
		for (const el of comments) {
			commentElements.push(el);
			requests.push({ text: el.text, type: 'comment' });
		}
	}

	if (options.translateIdentifiers) {
		const ids = extractDeclaredIdentifiers(code);
		for (const id of ids) {
			identifierNames.push(id);
			requests.push({ text: id, type: 'identifier' });
		}
	}

	if (requests.length === 0) {
		return code;
	}

	const translations = await translator.translateBatch(requests, targetLanguage);

	// Build translation map
	const translationMap = new Map<string, string>();
	for (let i = 0; i < requests.length; i++) {
		const translated = translations[i];
		if (translated && translated !== requests[i].text) {
			translationMap.set(requests[i].text, translated);
		}
	}

	let result = code;

	// Apply comment replacements first
	for (const el of commentElements) {
		const translated = translationMap.get(el.text);
		if (!translated) { continue; }

		let replacement: string;
		if (el.type === 'single') {
			replacement = `// ${translated}`;
		} else if (el.type === 'multi') {
			replacement = `/* ${translated} */`;
		} else {
			replacement = `# ${translated}`;
		}

		result = result.replace(el.pattern, replacement);
	}

	// Apply identifier replacements using word boundaries
	for (const id of identifierNames) {
		const translated = translationMap.get(id);
		if (!translated) { continue; }

		const wordBoundary = new RegExp(`\\b${escapeRegex(id)}\\b`, 'g');
		result = result.replace(wordBoundary, translated);
	}

	return result;
}
