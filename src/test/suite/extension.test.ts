import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('Extension is present', () => {
		const ext = vscode.extensions.getExtension('undefined_publisher.universal-language-handler');
		assert.ok(ext, 'Extension should be registered');
	});

	test('All three commands are registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('universal-language-handler.translateFile'),
			'translateFile command should be registered'
		);
		assert.ok(
			commands.includes('universal-language-handler.translateSelection'),
			'translateSelection command should be registered'
		);
		assert.ok(
			commands.includes('universal-language-handler.setLanguage'),
			'setLanguage command should be registered'
		);
	});

	test('Default configuration values are correct', () => {
		const config = vscode.workspace.getConfiguration('universalLanguageHandler');
		assert.strictEqual(config.get('targetLanguage'), 'Spanish');
		assert.strictEqual(config.get('translateComments'), true);
		assert.strictEqual(config.get('translateIdentifiers'), true);
		assert.strictEqual(config.get('anthropicApiKey'), '');
	});
});
