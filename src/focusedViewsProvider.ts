import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigLoader, View } from './configLoader';

export class FocusedViewItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly description?: string,
		public readonly command?: vscode.Command,
		public readonly contextValue?: string,
		public readonly resourceUri?: vscode.Uri
	) {
		super(label, collapsibleState);
		this.description = description;
		this.command = command;
		this.contextValue = contextValue;
		this.resourceUri = resourceUri;
	}
}

export class FocusedViewsProvider implements vscode.TreeDataProvider<FocusedViewItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<FocusedViewItem | undefined | null | void> = new vscode.EventEmitter<FocusedViewItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FocusedViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private configLoader: ConfigLoader) {}

	refresh(): void {
		this.configLoader.refresh();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FocusedViewItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: FocusedViewItem): Promise<FocusedViewItem[]> {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showInformationMessage('No workspace folder is open');
			return Promise.resolve([]);
		}

		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		
		// Root level items (views)
		if (!element) {
			const views = this.configLoader.getViews();
			if (!views) {
				return [
					new FocusedViewItem(
						'No .focusedviews file found',
						vscode.TreeItemCollapsibleState.None,
						'Create a .focusedviews file in your workspace root'
					)
				];
			}

			return Object.entries(views).map(([id, view]) => {
				const options = this.configLoader.getViewOptions(id);
				const collapsibleState = options.collapseOnOpen
					? vscode.TreeItemCollapsibleState.Collapsed
					: vscode.TreeItemCollapsibleState.Expanded;
				
				let description = view.description || '';
				
				// Show git branch if option is enabled
				if (options.showGitBranch && view.gitBranch) {
					description = description 
						? `${description} (${view.gitBranch})`
						: `Branch: ${view.gitBranch}`;
				}
				
				const viewItem = new FocusedViewItem(
					view.name,
					collapsibleState,
					description,
					undefined,
					'view',
					undefined
				);
				
				// Store the view ID in the context value
				viewItem.id = id;
				
				return viewItem;
			});
		}
		// Child items (files within a view)
		else if (element.contextValue === 'view' && element.id) {
			const viewId = element.id;
			const files = this.configLoader.getFilesForView(viewId);
			const options = this.configLoader.getViewOptions(viewId);
			const items: FocusedViewItem[] = [];
			
			// Handle README if enabled
			if (options.viewReadme) {
				const readmePath = path.join(workspaceRoot, 'README.md');
				if (fs.existsSync(readmePath)) {
					const readmeItem = new FocusedViewItem(
						'README.md',
						vscode.TreeItemCollapsibleState.None,
						'',
						{
							command: 'focusedViews.openFile',
							title: 'Open README',
							arguments: [readmePath]
						},
						'file',
						vscode.Uri.file(readmePath)
					);
					readmeItem.iconPath = new vscode.ThemeIcon('book');
					items.push(readmeItem);
				}
			}
			
			// Add files to the view
			files.forEach((filePath, index) => {
				const relativePath = path.relative(workspaceRoot, filePath);
				
				// Determine the label based on showFullPath option
				const label = options.showFullPath ? relativePath : path.basename(filePath);
				
				// Add numbers if configured
				const displayLabel = options.numberFiles ? `${index + 1}. ${label}` : label;
				
				// Add a description that shows the file's parent folder if not showing full path
				const description = !options.showFullPath 
					? path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : undefined
					: undefined;
				
				const fileItem = new FocusedViewItem(
					displayLabel,
					vscode.TreeItemCollapsibleState.None,
					description,
					{
						command: 'focusedViews.openFile',
						title: 'Open File',
						arguments: [filePath]
					},
					'file',
					vscode.Uri.file(filePath)
				);
				
				// Use VS Code's built-in file icon
				fileItem.resourceUri = vscode.Uri.file(filePath);
				
				items.push(fileItem);
			});
			
			return items;
		}
		
		return [];
	}
}
