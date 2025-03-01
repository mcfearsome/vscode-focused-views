import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigLoader, View } from './configLoader';

export class FocusedViewItem extends vscode.TreeItem {
	public id?: string;
	
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
	private outputChannel: vscode.OutputChannel;

	constructor(private configLoader: ConfigLoader, outputChannel: vscode.OutputChannel) {
		this.outputChannel = outputChannel;
	}

	async refresh(): Promise<void> {
		this.outputChannel.appendLine('Focused Views: Refreshing views');
		await this.configLoader.refresh();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FocusedViewItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: FocusedViewItem): Promise<FocusedViewItem[]> {
		if (element) {
			// If element is a view, return its files
			if (element.contextValue === 'view' && element.id) {
				const viewId = element.id;
				const views = this.configLoader.getViews();
				
				if (!views || !views[viewId]) {
					return [];
				}
				
				const files = views[viewId].files || [];
				const options = views[viewId].options || {};
				
				return files.map((file: string, index: number) => {
					const baseName = path.basename(file);
					const displayName = options.numberFiles 
						? `${index + 1}. ${baseName}` 
						: baseName;
					
					const fileUri = vscode.Uri.file(file);
					return new FocusedViewItem(
						displayName,
						vscode.TreeItemCollapsibleState.None,
						options.showFullPath ? file : baseName,
						{
							command: 'focusedViews.openFile',
							title: 'Open File',
							arguments: [file]
						},
						'file',
						fileUri
					);
				});
			}
			
			return [];
		} else {
			// No element means we're at the root, so return views
			const views = this.configLoader.getViews();
			
			if (!views) {
				return [
					new FocusedViewItem(
						'No views defined',
						vscode.TreeItemCollapsibleState.None,
						'Create a .focusedviews.json file in your workspace root'
					)
				];
			}
			
			return Object.entries(views).map(([id, view]) => {
				const options = view.options || {};
				let description = view.description || '';
				
				// Show git branch in description if requested
				if (options.showGitBranch && view.gitBranch) {
					description = description 
						? `${description} (${view.gitBranch})`
						: `Branch: ${view.gitBranch}`;
				}
				
				const item = new FocusedViewItem(
					view.name,
					options.collapseOnOpen 
						? vscode.TreeItemCollapsibleState.Collapsed 
						: vscode.TreeItemCollapsibleState.Expanded,
					description,
					options.viewReadme ? {
						command: 'focusedViews.openReadme',
						title: 'Open README',
						arguments: [id]
					} : undefined,
					'view'
				);
				
				// Store the view ID
				item.id = id;
				
				return item;
			});
		}
	}
}
