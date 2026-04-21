import * as assert from 'assert';
import { MockTranslator } from '../../translator';

suite('MockTranslator', () => {
	test('returns mapped translations for known text', async () => {
		const map = new Map([
			['hello', 'hola'],
			['world', 'mundo'],
		]);
		const translator = new MockTranslator(map);

		const results = await translator.translateBatch(
			[
				{ text: 'hello', type: 'comment' },
				{ text: 'world', type: 'identifier' },
			],
			'Spanish'
		);

		assert.strictEqual(results[0], 'hola');
		assert.strictEqual(results[1], 'mundo');
	});

	test('returns default suffix for unknown text', async () => {
		const translator = new MockTranslator();
		const results = await translator.translateBatch(
			[{ text: 'unknown', type: 'comment' }],
			'Spanish'
		);
		assert.strictEqual(results[0], 'unknown_translated');
	});

	test('returns empty array for empty input', async () => {
		const translator = new MockTranslator();
		const results = await translator.translateBatch([], 'Spanish');
		assert.deepStrictEqual(results, []);
	});

	test('handles multiple requests with partial map', async () => {
		const map = new Map([['sum', 'suma']]);
		const translator = new MockTranslator(map);
		const results = await translator.translateBatch(
			[
				{ text: 'sum', type: 'identifier' },
				{ text: 'calculate', type: 'identifier' },
			],
			'Spanish'
		);
		assert.strictEqual(results[0], 'suma');
		assert.strictEqual(results[1], 'calculate_translated');
	});
});
