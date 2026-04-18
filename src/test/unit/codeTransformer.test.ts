import * as assert from 'assert';
import { transformCode } from '../../codeTransformer';
import { MockTranslator } from '../../translator';

const translations = new Map([
	['takes numbers a and b and returns the sum', 'toma los números a y b y devuelve la suma'],
	['calculate the total', 'calcular el total'],
	['initialize the app', 'inicializar la aplicación'],
	['sum', 'suma'],
	['calculate', 'calcular'],
	['result', 'resultado'],
	['fetchData', 'obtenerDatos'],
	['MyClass', 'MiClase'],
]);

const translator = new MockTranslator(translations);
const both = { translateComments: true, translateIdentifiers: true };
const commentsOnly = { translateComments: true, translateIdentifiers: false };
const identifiersOnly = { translateComments: false, translateIdentifiers: true };
const neither = { translateComments: false, translateIdentifiers: false };

suite('transformCode — comments', () => {
	test('translates single-line // comments', async () => {
		const code = '// takes numbers a and b and returns the sum\nfunction foo() {}';
		const result = await transformCode(code, 'Spanish', translator, commentsOnly);
		assert.ok(
			result.includes('// toma los números a y b y devuelve la suma'),
			`Expected translated comment, got: ${result}`
		);
	});

	test('translates multi-line /* */ comments', async () => {
		const code = '/* calculate the total */\nconst x = 1;';
		const result = await transformCode(code, 'Spanish', translator, commentsOnly);
		assert.ok(result.includes('calcular el total'), `Got: ${result}`);
	});

	test('translates hash # comments', async () => {
		const code = '# initialize the app\ndef run(): pass';
		const result = await transformCode(code, 'Spanish', translator, commentsOnly);
		assert.ok(result.includes('inicializar la aplicación'), `Got: ${result}`);
	});

	test('deduplicates identical comments', async () => {
		const code = '// sum\n// sum\nfunction foo() {}';
		const result = await transformCode(code, 'Spanish', translator, commentsOnly);
		// Both occurrences should be translated — same translation applied via regex
		const count = (result.match(/\/\/ suma/g) || []).length;
		assert.strictEqual(count, 2, `Expected 2 translated comments, got: ${result}`);
	});
});

suite('transformCode — identifiers', () => {
	test('translates function declaration names', async () => {
		const code = 'function sum(a, b) { return a + b; }';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(result.includes('suma'), `Got: ${result}`);
		// Ensure the original word-boundary identifier is gone (use regex for word boundary)
		assert.ok(!/\bsum\b/.test(result), `Original "sum" still present: ${result}`);
	});

	test('translates const arrow function names', async () => {
		const code = 'const calculate = (x) => x * 2;';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(result.includes('calcular'), `Got: ${result}`);
	});

	test('translates variable declarations', async () => {
		const code = 'const result = 42;';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(result.includes('resultado'), `Got: ${result}`);
	});

	test('translates class names', async () => {
		const code = 'class MyClass { constructor() {} }';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(result.includes('MiClase'), `Got: ${result}`);
	});

	test('replaces all occurrences of identifier', async () => {
		const code = 'function sum(a, b) { return sum(a, b); }';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(!/\bsum\b/.test(result), `Original identifier still present: ${result}`);
	});

	test('skips blocklisted identifiers (keywords)', async () => {
		// 'if', 'for', 'return' etc. should not be translated even if in code
		const code = 'function foo() { if (true) { return 1; } }';
		const result = await transformCode(code, 'Spanish', translator, identifiersOnly);
		assert.ok(result.includes('if'), `Keyword "if" was incorrectly removed: ${result}`);
		assert.ok(result.includes('return'), `Keyword "return" was incorrectly removed: ${result}`);
	});
});

suite('transformCode — combined', () => {
	test('translates both comments and identifiers', async () => {
		const code =
			'// takes numbers a and b and returns the sum\n' +
			'function sum(a, b) { return a + b; }';
		const result = await transformCode(code, 'Spanish', translator, both);
		assert.ok(result.includes('toma los números'), `Comment not translated: ${result}`);
		assert.ok(result.includes('suma'), `Identifier not translated: ${result}`);
	});

	test('returns code unchanged when neither option is set', async () => {
		const code = '// sum\nfunction sum(a, b) { return a + b; }';
		const result = await transformCode(code, 'Spanish', translator, neither);
		assert.strictEqual(result, code);
	});

	test('returns code unchanged when no translatable elements exist', async () => {
		const code = 'const x = 1;'; // 'x' is 1 char — below minimum length
		const noTranslations = new MockTranslator();
		const result = await transformCode(code, 'Spanish', noTranslations, both);
		// x is 1 char, filtered out. Code has no comments. Should be unchanged.
		assert.strictEqual(result, code);
	});
});
