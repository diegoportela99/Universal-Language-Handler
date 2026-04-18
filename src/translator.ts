import Anthropic from '@anthropic-ai/sdk';

export interface TranslationRequest {
	text: string;
	type: 'comment' | 'identifier';
}

export interface ITranslator {
	translateBatch(requests: TranslationRequest[], targetLanguage: string): Promise<string[]>;
}

const SYSTEM_PROMPT =
	'You are a code translation assistant. Your job is to translate code elements ' +
	'(comments and identifiers) into a specified target language while preserving ' +
	'programming conventions. For identifiers, produce a single camelCase or lowercase ' +
	'word in the target language. For comments, translate the full text naturally. ' +
	'Always respond with a valid JSON array of strings, one translation per element, ' +
	'in the same order as the input. Output nothing except the JSON array.';

export class ClaudeTranslator implements ITranslator {
	private readonly client: Anthropic;

	constructor(apiKey?: string) {
		this.client = new Anthropic({ apiKey });
	}

	async translateBatch(requests: TranslationRequest[], targetLanguage: string): Promise<string[]> {
		if (requests.length === 0) {
			return [];
		}

		const numbered = requests
			.map((r, i) => `${i + 1}. (${r.type}) ${JSON.stringify(r.text)}`)
			.join('\n');

		const userPrompt =
			`Translate the following code elements to ${targetLanguage}.\n` +
			`Return a JSON array with exactly ${requests.length} translated strings.\n\n` +
			`Elements:\n${numbered}`;

		const message = await this.client.messages.create({
			model: 'claude-opus-4-7',
			max_tokens: 2048,
			system: [
				{
					type: 'text',
					text: SYSTEM_PROMPT,
					// Cache the stable system prompt across repeated translation calls
					cache_control: { type: 'ephemeral' },
				},
			],
			messages: [{ role: 'user', content: userPrompt }],
		});

		const block = message.content[0];
		if (block.type !== 'text') {
			throw new Error('Unexpected response type from Claude API');
		}

		const jsonMatch = block.text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) {
			throw new Error('Could not parse JSON array from translation response');
		}

		const translations: unknown = JSON.parse(jsonMatch[0]);
		if (!Array.isArray(translations) || translations.length !== requests.length) {
			throw new Error(
				`Expected ${requests.length} translations, got ${Array.isArray(translations) ? translations.length : 'non-array'}`
			);
		}

		return translations.map((t) => (typeof t === 'string' ? t : String(t)));
	}
}

export class MockTranslator implements ITranslator {
	private readonly translations: Map<string, string>;

	constructor(translations: Map<string, string> = new Map()) {
		this.translations = translations;
	}

	async translateBatch(requests: TranslationRequest[], _targetLanguage: string): Promise<string[]> {
		return requests.map((r) => this.translations.get(r.text) ?? `${r.text}_translated`);
	}
}
