import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { execSync } from 'child_process';

export interface ViewOptions {
	numberFiles?: boolean;
	viewReadme?: boolean;
	showFullPath?: boolean;
	showGitBranch?: boolean;
	collapseOnOpen?: boolean;
}

export interface View {
	name: string;
	description?: string;
	files: string[];
	gitBranch?: string;
	options?: ViewOptions;
}

export interface Config {
	version: string;
	views: Record<string, View>;
}

export class ConfigLoader {
	private configPath: string | undefined;
	private config: Config | undefined;

	constructor() {
		this.findConfigFile();
	}

	public getConfig(): Config | undefined {
		return this.config;
	}

	public getViews(): Record<string, View> | undefined {
		return this.config?.views;
	}

	public refresh(): void {
		this.findConfigFile();
	}

	private findConfigFile(): void {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showWarningMessage('Focused Views: No workspace folder found.');
			return;
		}

		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const configPath = path.join(workspaceRoot, '.focusedviews');

		if (fs.existsSync(configPath)) {
			this.configPath = configPath;
			this.loadConfig();
		} else {
			this.config = undefined;
			vscode.window.showInformationMessage('Focused Views: No .focusedviews configuration file found.');
		}
	}

	private loadConfig(): void {
		if (!this.configPath) {
			return;
		}

		try {
			// Execute CUE to validate and extract the configuration
			// This is a simple approach that requires the cue command to be installed
			// A more robust solution would use the CUE library directly
			const cueTempFile = path.join(path.dirname(this.configPath), '.focusedviews.json');
			
			try {
				// Use CUE to validate and export to JSON
				execSync(`cue export ${this.configPath} -o ${cueTempFile}`, { encoding: 'utf8' });
				
				// Read the exported JSON
				const configJson = fs.readFileSync(cueTempFile, 'utf8');
				this.config = JSON.parse(configJson);
				
				// Clean up the temporary file
				fs.unlinkSync(cueTempFile);
			} catch (error) {
				// Handle CUE validation errors
				console.error('Error validating CUE configuration:', error);
				vscode.window.showErrorMessage('Focused Views: Invalid .focusedviews configuration. Check the CUE syntax.');
				return;
			}
			
			// Now we need to resolve file patterns to actual files
			if (this.config && this.config.views) {
				const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
				
				for (const viewId in this.config.views) {
					const view = this.config.views[viewId];
					const resolvedFiles: string[] = [];
					
					// Resolve each file pattern
					for (const pattern of view.files) {
						try {
							const matches = glob.sync(pattern, { 
								cwd: workspaceRoot,
								absolute: true,
								nodir: true
							});
							resolvedFiles.push(...matches);
						} catch (err) {
							console.error(`Error resolving pattern ${pattern}:`, err);
						}
					}
					
					// Update the view with the resolved files
					view.files = resolvedFiles;
				}
			}
		} catch (error) {
			console.error('Error loading configuration:', error);
			vscode.window.showErrorMessage('Focused Views: Error loading configuration.');
			this.config = undefined;
		}
	}

	public getFilesForView(viewId: string): string[] {
		if (!this.config || !this.config.views || !this.config.views[viewId]) {
			return [];
		}
		
		const view = this.config.views[viewId];
		return view.files || [];
	}

	public getViewGitBranch(viewId: string): string | undefined {
		if (!this.config || !this.config.views || !this.config.views[viewId]) {
			return undefined;
		}
		
		return this.config.views[viewId].gitBranch;
	}

	public getViewOptions(viewId: string): ViewOptions {
		if (!this.config || !this.config.views || !this.config.views[viewId] || !this.config.views[viewId].options) {
			return {};
		}
		
		return this.config.views[viewId].options || {};
	}
}
