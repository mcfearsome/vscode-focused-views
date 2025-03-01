import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FocusedViewsProvider } from './focusedViewsProvider';
import { ConfigLoader } from './configLoader';

// Create an output channel for logging
const outputChannel = vscode.window.createOutputChannel('Focused Views');

export function activate(context: vscode.ExtensionContext) {
	console.log('Activating Focused Views extension');
	outputChannel.appendLine('Focused Views extension is now active!');
	outputChannel.appendLine(`VS Code version: ${vscode.version}`);
	outputChannel.appendLine(`Extension path: ${context.extensionPath}`);
	
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		outputChannel.appendLine(`Workspace root: ${vscode.workspace.workspaceFolders[0].uri.fsPath}`);
	} else {
		outputChannel.appendLine('No workspace folder found');
	}
	
	// Initialize the config loader and tree view provider
	const configLoader = new ConfigLoader(outputChannel);
	const focusedViewsProvider = new FocusedViewsProvider(configLoader, outputChannel);
	
	// Register the tree view
	vscode.window.registerTreeDataProvider('focusedViews', focusedViewsProvider);
	
	// Register the refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.refresh', async () => {
			await focusedViewsProvider.refresh();
		})
	);

	// Register the command to open a file
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.openFile', async (filePath) => {
			// Check if this file is from a branch that doesn't allow direct edits
			const viewId = configLoader.getViewIdForFile(filePath);
			if (viewId) {
				const directEditsAllowed = configLoader.areDirectEditsAllowed(viewId);
				const isFromDifferentBranch = await configLoader.isFileFromDifferentBranch(filePath);
				
				if (isFromDifferentBranch && !directEditsAllowed) {
					// Ask user if they want to create a branch for editing
					const createBranch = 'Create Branch & Edit';
					const viewOnly = 'View Only';
					const response = await vscode.window.showWarningMessage(
						`This file is from branch '${configLoader.getBranchForView(viewId)}' which doesn't allow direct edits. Would you like to create a branch for editing?`,
						createBranch, 
						viewOnly
					);
					
					if (response === createBranch) {
						// Create a branch for editing and then open the file
						const newBranch = await configLoader.createBranchForEdit(viewId, filePath);
						if (newBranch) {
							// After branch is created, refresh the views and open the file
							focusedViewsProvider.refresh();
							const doc = await vscode.workspace.openTextDocument(filePath);
							await vscode.window.showTextDocument(doc);
							return;
						}
					} else if (response === viewOnly) {
						// Open the file as read-only
						const doc = await vscode.workspace.openTextDocument(filePath);
						await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
						return;
					} else {
						// User canceled, don't open the file
						return;
					}
				}
			}
			
			// Normal file opening behavior
			const doc = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(doc);
		})
	);

	// Register the command to open a readme
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.openReadme', async (viewId) => {
			if (!vscode.workspace.workspaceFolders) {
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const readmePath = path.join(workspaceRoot, 'README.md');
			
			if (fs.existsSync(readmePath)) {
				const doc = await vscode.workspace.openTextDocument(readmePath);
				await vscode.window.showTextDocument(doc);
			} else {
				vscode.window.showInformationMessage('No README.md file found in workspace root.');
			}
		})
	);

	// Register command to view files from a branch without switching to it
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.viewBranchFiles', async (viewId) => {
			const branch = configLoader.getBranchForView(viewId);
			if (!branch) {
				vscode.window.showInformationMessage(`No Git branch specified for view: ${viewId}`);
				return;
			}

			vscode.window.showInformationMessage(`Viewing files from branch: ${branch}`);
		})
	);

	// Register command to create a PR from the current branch
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.createPullRequest', async () => {
			if (!vscode.workspace.workspaceFolders) {
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			
			try {
				// Get the current branch name
				const { stdout: branchName } = await require('util').promisify(require('child_process').exec)(
					'git rev-parse --abbrev-ref HEAD',
					{ cwd: workspaceRoot }
				);
				
				// Extract source branch from our naming convention (edit/sourceBranch/...)
				const match = branchName.trim().match(/^edit\/([^\/]+)\//);
				if (!match) {
					vscode.window.showWarningMessage('Current branch does not appear to be an edit branch created by Focused Views.');
					return;
				}
				
				const targetBranch = match[1];
				
				// Run the command to open GitHub/GitLab/etc to create a PR
				let remoteUrl: string;
				try {
					const { stdout } = await require('util').promisify(require('child_process').exec)(
						'git remote get-url origin',
						{ cwd: workspaceRoot }
					);
					remoteUrl = stdout.trim();
				} catch (error) {
					vscode.window.showErrorMessage('Could not determine the remote repository URL.');
					return;
				}
				
				// Detect GitHub, GitLab, or Bitbucket and create appropriate PR URL
				let prUrl: string | undefined;
				
				if (remoteUrl.includes('github.com')) {
					// Format: https://github.com/username/repo/compare/targetBranch...currentBranch?expand=1
					prUrl = remoteUrl.replace(/\.git$/, '')
						.replace(/^git@github\.com:/, 'https://github.com/')
						+ `/compare/${targetBranch}...${branchName.trim()}?expand=1`;
				} else if (remoteUrl.includes('gitlab.com')) {
					// Format: https://gitlab.com/username/repo/-/merge_requests/new?merge_request[source_branch]=currentBranch&merge_request[target_branch]=targetBranch
					prUrl = remoteUrl.replace(/\.git$/, '')
						.replace(/^git@gitlab\.com:/, 'https://gitlab.com/')
						+ `/-/merge_requests/new?merge_request[source_branch]=${branchName.trim()}&merge_request[target_branch]=${targetBranch}`;
				} else if (remoteUrl.includes('bitbucket.org')) {
					// Format: https://bitbucket.org/username/repo/pull-requests/new?source=currentBranch&dest=targetBranch
					prUrl = remoteUrl.replace(/\.git$/, '')
						.replace(/^git@bitbucket\.org:/, 'https://bitbucket.org/')
						+ `/pull-requests/new?source=${branchName.trim()}&dest=${targetBranch}`;
				} else {
					vscode.window.showWarningMessage('Could not determine the type of remote repository. Only GitHub, GitLab, and Bitbucket are supported for automatic PR creation.');
					return;
				}
				
				if (prUrl) {
					// Open the PR creation URL in the default browser
					await vscode.env.openExternal(vscode.Uri.parse(prUrl));
				}
			} catch (error) {
				console.error('Error creating PR:', error);
				vscode.window.showErrorMessage(`Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		})
	);

	// Register a command to display information about the current edit branch
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.showEditBranchInfo', async () => {
			if (!vscode.workspace.workspaceFolders) {
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			
			try {
				// Get the current branch name
				const { stdout: branchName } = await require('util').promisify(require('child_process').exec)(
					'git rev-parse --abbrev-ref HEAD',
					{ cwd: workspaceRoot }
				);
				
				const branch = branchName.trim();
				
				// Check if this is an edit branch
				if (!branch.startsWith('edit/')) {
					vscode.window.showInformationMessage('You are not currently on an edit branch created by Focused Views.');
					return;
				}
				
				// Extract source branch from the naming convention
				const match = branch.match(/^edit\/([^\/]+)\//);
				if (!match) {
					vscode.window.showInformationMessage(`Current branch: ${branch}`);
					return;
				}
				
				const sourceBranch = match[1];
				
				// Show information and actions
				const createPr = 'Create Pull Request';
				const result = await vscode.window.showInformationMessage(
					`Current edit branch: ${branch}\nSource branch: ${sourceBranch}`,
					createPr
				);
				
				if (result === createPr) {
					await vscode.commands.executeCommand('focusedViews.createPullRequest');
				}
			} catch (error) {
				console.error('Error getting branch info:', error);
				vscode.window.showErrorMessage(`Failed to get branch info: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		})
	);

	// Register command to create a sample config file
	context.subscriptions.push(
		vscode.commands.registerCommand('focusedViews.createSampleConfig', async () => {
			if (!vscode.workspace.workspaceFolders) {
				vscode.window.showErrorMessage('Focused Views: No workspace folder found.');
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const configPath = path.join(workspaceRoot, '.focusedviews.json');
			
			const sampleConfig = {
				version: "1.0.0",
				views: {
					"main": {
						name: "Main View",
						description: "Main files",
						files: [
							"src/**/*.ts",
							"src/**/*.js"
						],
						options: {
							showFullPath: false,
							numberFiles: true
						}
					},
					"docs": {
						name: "Documentation",
						description: "Documentation files",
						files: [
							"README.md",
							"docs/**/*.md"
						],
						options: {
							showFullPath: true
						}
					}
				}
			};
			
			try {
				fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2), 'utf8');
				vscode.window.showInformationMessage(`Focused Views: Created sample config file at ${configPath}`);
				
				// Refresh the views
				await vscode.commands.executeCommand('focusedViews.refresh');
			} catch (error) {
				vscode.window.showErrorMessage(`Focused Views: Failed to create sample config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		})
	);

	// File system watcher for the .focusedviews file
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		
		// Watch for changes to the configuration files
		const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, '{.focusedviews,.focusedviews.json,.focusedviews.jsonc}'));
		
		fileSystemWatcher.onDidChange(async () => {
			console.log('Focused Views: Configuration file changed, refreshing views');
			outputChannel.appendLine('Focused Views: Configuration file changed, refreshing views');
			await focusedViewsProvider.refresh();
		});
		
		fileSystemWatcher.onDidCreate(async () => {
			console.log('Focused Views: Configuration file created, refreshing views');
			outputChannel.appendLine('Focused Views: Configuration file created, refreshing views');
			await focusedViewsProvider.refresh();
		});
		
		fileSystemWatcher.onDidDelete(async () => {
			console.log('Focused Views: Configuration file deleted, refreshing views');
			outputChannel.appendLine('Focused Views: Configuration file deleted, refreshing views');
			await focusedViewsProvider.refresh();
		});
		
		context.subscriptions.push(fileSystemWatcher);
	}

	// Status bar item for edit branches
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'focusedViews.showEditBranchInfo';
	statusBarItem.tooltip = 'Click to see edit branch information and actions';
	context.subscriptions.push(statusBarItem);
	
	// Update status bar with the current branch info
	async function updateStatusBar() {
		if (!vscode.workspace.workspaceFolders) {
			statusBarItem.hide();
			return;
		}
		
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		
		try {
			const { stdout: branchName } = await require('util').promisify(require('child_process').exec)(
				'git rev-parse --abbrev-ref HEAD',
				{ cwd: workspaceRoot }
			);
			
			const branch = branchName.trim();
			
			// Only show for edit branches
			if (branch.startsWith('edit/')) {
				statusBarItem.text = `$(git-branch) ${branch}`;
				statusBarItem.show();
			} else {
				statusBarItem.hide();
			}
		} catch (error) {
			statusBarItem.hide();
		}
	}
	
	// Update status bar initially and when git branch changes
	updateStatusBar();
	
	// Update status bar when the active editor changes (this helps detect branch changes)
	vscode.window.onDidChangeActiveTextEditor(() => {
		updateStatusBar();
	});
	
	// Update status bar when files are saved (may indicate commits/branch changes)
	vscode.workspace.onDidSaveTextDocument(() => {
		updateStatusBar();
	});
}

export function deactivate() {}
