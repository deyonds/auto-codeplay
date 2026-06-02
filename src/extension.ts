import * as vscode from 'vscode';
import * as path from 'path';

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

let isPaused = false;
let isRunning = false;

async function waitIfPaused() {
	while (isPaused) {
		await sleep(100);
	}
}

async function typeCode(
	editor: vscode.TextEditor,
	text: string,
	cps: number
) {
	isRunning = true;

	try {
		const lines = text.split(/\r?\n/);
		let position = editor.selection.active;

		for (const line of lines) {

			for (let i = 0; i < line.length; i++) {

				await waitIfPaused();

				await editor.edit(editBuilder => {
					editBuilder.insert(position, line[i]);
				});

				position = position.translate(0, 1);

				editor.selection = new vscode.Selection(
					position,
					position
				);

				editor.revealRange(
					new vscode.Range(position, position),
					vscode.TextEditorRevealType.Default
				);

				await sleep(1000 / cps);
			}

			await waitIfPaused();

			await editor.edit(editBuilder => {
				editBuilder.insert(position, '\n');
			});

			position = new vscode.Position(
				position.line + 1,
				0
			);

			editor.selection = new vscode.Selection(
				position,
				position
			);

			editor.revealRange(
				new vscode.Range(position, position),
				vscode.TextEditorRevealType.Default
			);

			await sleep(1000 / cps);
		}
	} finally {
		isRunning = false;
		isPaused = false;
	}
}

export function activate(context: vscode.ExtensionContext) {

	const startDisposable = vscode.commands.registerCommand(
		'codeReplay.start',
		async () => {

			if (isRunning) {
				vscode.window.showWarningMessage(
					'A replay is already running.'
				);
				return;
			}

			const config =
				vscode.workspace.getConfiguration(
					'liveReplay'
				);

			const cps: number =
				config.get('speed', 50);

			const sourceFilePath: string =
				config.get('sourceFile', '').trim();

			if (sourceFilePath) {

				let fullPath: vscode.Uri;

				if (path.isAbsolute(sourceFilePath)) {
					fullPath = vscode.Uri.file(
						sourceFilePath
					);
				} else {
					
					const folders =vscode.workspace.workspaceFolders;
					if (!folders) {
						vscode.window.showErrorMessage(
							'Please open a workspace folder.'
						);
						return;
					}
					fullPath = vscode.Uri.joinPath(
						folders[0].uri,
						sourceFilePath
					);
				}

				try {

					const fileDoc =
						await vscode.workspace.openTextDocument(
							fullPath
						);

					const text =
						fileDoc.getText();

					const activeEditor =
						vscode.window.activeTextEditor;

					if (!activeEditor) {
						vscode.window.showErrorMessage(
							'Open a file to type into.'
						);
						return;
					}

					await typeCode(
						activeEditor,
						text,
						cps
					);

				} catch {

					vscode.window.showErrorMessage(
						`Could not read file: ${sourceFilePath}`
					);
				}

			} else {

				const activeEditor =
					vscode.window.activeTextEditor;

				if (
					!activeEditor ||
					activeEditor.document.isUntitled
				) {
					vscode.window.showErrorMessage(
						'Open a saved file to replay from.'
					);
					return;
				}

				const text =
					activeEditor.document.getText();

				const langId =
					activeEditor.document.languageId;

				const newDoc =
					await vscode.workspace.openTextDocument({
						language: langId,
						content: ''
					});

				const newEditor =
					await vscode.window.showTextDocument(
						newDoc,
						vscode.ViewColumn.Beside
					);

				await typeCode(
					newEditor,
					text,
					cps
				);
			}
		}
	);

	const pauseDisposable =
		vscode.commands.registerCommand(
			'codeReplay.pause',
			() => {

				if (!isRunning) {
					vscode.window.showInformationMessage(
						'No replay is running.'
					);
					return;
				}

				isPaused = true;

				vscode.window.showInformationMessage(
					'Replay paused.'
				);
			}
		);

	const resumeDisposable =
		vscode.commands.registerCommand(
			'codeReplay.resume',
			() => {

				if (!isRunning) {
					vscode.window.showInformationMessage(
						'No replay is running.'
					);
					return;
				}

				isPaused = false;

				vscode.window.showInformationMessage(
					'Replay resumed.'
				);
			}
		);

	context.subscriptions.push(
		startDisposable,
		pauseDisposable,
		resumeDisposable
	);
}

export function deactivate() {}
