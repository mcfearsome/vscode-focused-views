import * as vscode from 'vscode';
import { FocusedViewsProvider } from './focusedViewsProvider';
import { ConfigLoader } from './configLoader';

export function activate(context: vscode.ExtensionContext) {
	console.log('Focused Views extension is now active');

	// Initialize the config loader
	const configLoader = new ConfigLoader();
	
	// Register the TreeDataProvider for the Focused Views
	const focusedViewsProvider = new FocusedViewsProvider(configLoader);
	vscode.window.registerTreeDataProvider('focusedViews', focusedViewsProvider);
	
	// Register the refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.refresh', () => {
			focusedViewsProvider.refresh();
		})
	);

	// Register the open file command
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.openFile', (filePath: string) => {
			const uri = vscode.Uri.file(filePath);
			vscode.workspace.openTextDocument(uri).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		})
	);

	// File system watcher for the .focusedviews file
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const configWatcher = vscode.workspace.createFileSystemWatcher('**/.focusedviews');
		
		configWatcher.onDidCreate(() => focusedViewsProvider.refresh());
		configWatcher.onDidChange(() => focusedViewsProvider.refresh());
		configWatcher.onDidDelete(() => focusedViewsProvider.refresh());
		
		context.subscriptions.push(configWatcher);
	}
}

export function deactivate() {}
