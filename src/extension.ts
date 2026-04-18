import * as vscode from 'vscode';
import { ClaudeTranslator } from './translator';
import { transformCode } from './codeTransformer';
import { SUPPORTED_LANGUAGES } from './languages';

function getConfig() {
	return vscode.workspace.getConfiguration('universalLanguageHandler');
}

function getTranslator(): ClaudeTranslator | null {
	const config = getConfig();
	const apiKey =
		(config.get<string>('anthropicApiKey') || '').trim() ||
		process.env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		vscode.window.showErrorMessage(
			'Anthropic API key not configured. ' +
			'Set "universalLanguageHandler.anthropicApiKey" in settings ' +
			'or the ANTHROPIC_API_KEY environment variable.'
		);
		return null;
	}

	return new ClaudeTranslator(apiKey);
}

async function runTranslation(
	editor: vscode.TextEditor,
	text: string,
	range: vscode.Range
): Promise<void> {
	const translator = getTranslator();
	if (!translator) { return; }

	const config = getConfig();
	const targetLanguage = config.get<string>('targetLanguage', 'Spanish');
	const translateComments = config.get<boolean>('translateComments', true);
	const translateIdentifiers = config.get<boolean>('translateIdentifiers', true);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Translating to ${targetLanguage}…`,
			cancellable: false,
		},
		async () => {
			const transformed = await transformCode(text, targetLanguage, translator, {
				translateComments,
				translateIdentifiers,
			});
			await editor.edit((eb) => eb.replace(range, transformed));
		}
	);

	vscode.window.showInformationMessage(`Translated to ${targetLanguage}.`);
}

export function activate(context: vscode.ExtensionContext): void {
	const translateFile = vscode.commands.registerCommand(
		'universal-language-handler.translateFile',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor.');
				return;
			}

			const doc = editor.document;
			const text = doc.getText();
			const fullRange = new vscode.Range(
				doc.positionAt(0),
				doc.positionAt(text.length)
			);

			try {
				await runTranslation(editor, text, fullRange);
			} catch (err) {
				vscode.window.showErrorMessage(
					`Translation failed: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}
	);

	const translateSelection = vscode.commands.registerCommand(
		'universal-language-handler.translateSelection',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.selection.isEmpty) {
				vscode.window.showErrorMessage('No text selected.');
				return;
			}

			const selectedText = editor.document.getText(editor.selection);
			try {
				await runTranslation(editor, selectedText, editor.selection);
			} catch (err) {
				vscode.window.showErrorMessage(
					`Translation failed: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}
	);

	const setLanguage = vscode.commands.registerCommand(
		'universal-language-handler.setLanguage',
		async () => {
			const selected = await vscode.window.showQuickPick([...SUPPORTED_LANGUAGES], {
				placeHolder: 'Select target language for translation',
			});

			if (selected) {
				await getConfig().update(
					'targetLanguage',
					selected,
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage(`Target language set to ${selected}.`);
			}
		}
	);

	context.subscriptions.push(translateFile, translateSelection, setLanguage);
}

export function deactivate(): void { /* no cleanup needed */ }
