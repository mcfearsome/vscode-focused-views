import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ViewOptions {
	numberFiles?: boolean;
	viewReadme?: boolean;
	showFullPath?: boolean;
	showGitBranch?: boolean;
	collapseOnOpen?: boolean;
	allowDirectEdits?: boolean;
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
	private config?: Config;
	private configPath?: string;
	private workspaceRoot?: string;
	private isGitAvailable: boolean = false;
	private currentGitBranch?: string;
	private outputChannel: vscode.OutputChannel;

	constructor(outputChannel: vscode.OutputChannel) {
		this.isGitAvailable = false;
		this.outputChannel = outputChannel;
		this.init();
	}

	private async init(): Promise<void> {
		// First check Git availability
		await this.checkGitAvailability();
		
		// Then find and load the configuration file
		this.findConfigFile();
	}

	private async checkGitAvailability(): Promise<void> {
		try {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				this.isGitAvailable = false;
				return;
			}
			
			this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			
			// Check if git is available by trying to execute 'git --version'
			await execAsync('git --version', { cwd: this.workspaceRoot });
			
			// Check if the current directory is a git repository
			await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
			
			this.isGitAvailable = true;
			this.outputChannel.appendLine('Focused Views: Git is available');
		} catch (error) {
			this.isGitAvailable = false;
			this.outputChannel.appendLine('Focused Views: Git is not available');
		}
	}

	public getConfig(): Config | undefined {
		return this.config;
	}

	public getViews(): { [key: string]: View } {
		if (!this.config || !this.config.views) {
			this.outputChannel.appendLine('Focused Views: No configuration loaded or no views defined');
			return {};
		}
		
		return this.config.views;
	}

	public async refresh(): Promise<void> {
		this.outputChannel.appendLine('Focused Views: Refreshing configuration');
		
		// Reset the current configuration
		this.config = undefined;
		this.configPath = undefined;
		
		// Find and load the configuration file
		this.findConfigFile();
		
		if (this.configPath) {
			// If we found a config file, load it
			await this.loadConfig();
		}
		
		if (this.config) {
			this.outputChannel.appendLine('Focused Views: Configuration refreshed successfully');
		} else {
			this.outputChannel.appendLine('Focused Views: No configuration found after refresh');
		}
	}

	private async getCurrentGitBranch(): Promise<string | undefined> {
		if (!this.isGitAvailable || !this.workspaceRoot) {
			return undefined;
		}

		try {
			const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.workspaceRoot });
			return stdout.trim();
		} catch (error) {
			this.outputChannel.appendLine(`Error getting current git branch: ${error}`);
			return undefined;
		}
	}

	public async getFilesFromBranch(branch: string, patterns: string[]): Promise<string[]> {
		if (!this.isGitAvailable || !this.workspaceRoot) {
			return [];
		}

		const currentBranch = await this.getCurrentGitBranch();
		if (!currentBranch) {
			return [];
		}

		const files: string[] = [];
		
		try {
			// If we're already on the requested branch, just use normal file resolution
			if (branch === currentBranch) {
				return this.resolveFilePatterns(patterns);
			}

			// Otherwise, we need to list files from a different branch without switching to it
			const { stdout } = await execAsync(`git ls-tree -r --name-only ${branch}`, { cwd: this.workspaceRoot });
			const branchFiles = stdout.split('\n').filter(Boolean);
			
			// Match the branch files against the requested patterns
			for (const pattern of patterns) {
				// Convert glob pattern to a simple regex pattern
				// This is a simplified version that handles basic glob patterns
				const regexPattern = this.convertGlobToRegExp(pattern);
				
				// Filter files that match the pattern
				const matchedFiles = branchFiles.filter(file => regexPattern.test(file));
				
				// Add the workspace path to make absolute paths
				const absoluteFiles = matchedFiles.map(file => path.join(this.workspaceRoot!, file));
				files.push(...absoluteFiles);
			}
		} catch (error) {
			this.outputChannel.appendLine(`Error getting files from branch ${branch}: ${error}`);
		}
		
		return files;
	}

	private resolveFilePatterns(patterns: string[]): string[] {
		if (!this.workspaceRoot) {
			return [];
		}

		const resolvedFiles: string[] = [];
		
		for (const pattern of patterns) {
			try {
				const matches = glob.sync(pattern, { 
					cwd: this.workspaceRoot,
					absolute: true,
					nodir: true
				});
				resolvedFiles.push(...matches);
			} catch (err) {
				this.outputChannel.appendLine(`Error resolving pattern ${pattern}: ${err}`);
			}
		}
		
		return resolvedFiles;
	}

	private findConfigFile(): void {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			this.outputChannel.appendLine('Focused Views: No workspace folder found.');
			vscode.window.showWarningMessage('Focused Views: No workspace folder found.');
			return;
		}

		this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		this.outputChannel.appendLine(`Focused Views: Looking for config files in workspace root: ${this.workspaceRoot}`);
		
		// Look for possible config files in multiple locations
		const possibleConfigFiles = [
			path.join(this.workspaceRoot, '.focusedviews.json'),
			path.join(this.workspaceRoot, 'focusedviews.json'),
			path.join(this.workspaceRoot, '.focusedviews.jsonc'),
			path.join(this.workspaceRoot, 'focusedviews.jsonc'),
			path.join(this.workspaceRoot, '.focusedviews'),
			path.join(this.workspaceRoot, '.vscode', '.focusedviews.json'),
			path.join(this.workspaceRoot, '.vscode', 'focusedviews.json'),
			path.join(this.workspaceRoot, '.vscode', '.focusedviews.jsonc'),
			path.join(this.workspaceRoot, '.vscode', 'focusedviews.jsonc'),
			path.join(this.workspaceRoot, '.vscode', '.focusedviews'),
			path.join(this.workspaceRoot, 'examples', '.focusedviews.json'),
			path.join(this.workspaceRoot, 'examples', 'focusedviews.json'),
		];

		this.outputChannel.appendLine(`Focused Views: Checking ${possibleConfigFiles.length} potential config file paths`);

		for (const configPath of possibleConfigFiles) {
			this.outputChannel.appendLine(`Focused Views: Checking if file exists: ${configPath}`);
			let exists = false;
			try {
				const stats = fs.statSync(configPath);
				exists = stats.isFile();
				this.outputChannel.appendLine(`Focused Views: File exists: ${exists}, isFile: ${stats.isFile()}, size: ${stats.size} bytes`);
			} catch (error) {
				this.outputChannel.appendLine(`Focused Views: File does not exist: ${configPath}`);
				exists = false;
			}
			
			if (exists) {
				this.configPath = configPath;
				this.outputChannel.appendLine(`Focused Views: Using configuration file at ${this.configPath}`);
				vscode.window.showInformationMessage(`Focused Views: Using configuration file at ${this.configPath}`);
				this.loadConfig();
				return;
			}
		}

		this.outputChannel.appendLine('Focused Views: No configuration file found in standard locations');
		
		// Check if there are any .focusedviews* files in the workspace root using fs.readdirSync
		try {
			const files = fs.readdirSync(this.workspaceRoot);
			this.outputChannel.appendLine(`Focused Views: Found ${files.length} files in workspace root`);
			
			const configFiles = files.filter(file => 
				file === '.focusedviews' || 
				file === '.focusedviews.json' || 
				file === '.focusedviews.jsonc' || 
				file === 'focusedviews.json' || 
				file === 'focusedviews.jsonc'
			);
			
			if (configFiles.length > 0) {
				this.outputChannel.appendLine(`Focused Views: Found these potential config files: ${configFiles.join(', ')}`);
			} else {
				this.outputChannel.appendLine('Focused Views: No potential config files found in workspace root');
			}
			
			// Also check in examples directory
			const examplesDir = path.join(this.workspaceRoot, 'examples');
			if (fs.existsSync(examplesDir) && fs.statSync(examplesDir).isDirectory()) {
				const examplesFiles = fs.readdirSync(examplesDir);
				this.outputChannel.appendLine(`Focused Views: Found ${examplesFiles.length} files in examples directory`);
				
				const examplesConfigFiles = examplesFiles.filter(file => 
					file === '.focusedviews' || 
					file === '.focusedviews.json' || 
					file === '.focusedviews.jsonc' || 
					file === 'focusedviews.json' || 
					file === 'focusedviews.jsonc'
				);
				
				if (examplesConfigFiles.length > 0) {
					this.outputChannel.appendLine(`Focused Views: Found these potential config files in examples: ${examplesConfigFiles.join(', ')}`);
				} else {
					this.outputChannel.appendLine('Focused Views: No potential config files found in examples directory');
				}
			}
		} catch (error) {
			this.outputChannel.appendLine(`Focused Views: Error reading workspace directory: ${error}`);
		}

		this.config = undefined;
		this.outputChannel.appendLine('Focused Views: No configuration file found. Create a .focusedviews.json file in your workspace root.');
		vscode.window.showInformationMessage('Focused Views: No configuration file found. Create a .focusedviews.json file in your workspace root.');
	}

	/**
	 * Load the configuration from the config file
	 */
	public async loadConfig(): Promise<void> {
		if (!this.configPath) {
			this.findConfigFile();
			return;
		}
		
		try {
			this.outputChannel.appendLine(`Focused Views: Loading config from ${this.configPath}`);
			
			// Read the config file
			const configContent = fs.readFileSync(this.configPath, 'utf8');
			this.outputChannel.appendLine(`Focused Views: Config file content: ${configContent.substring(0, 500)}${configContent.length > 500 ? '...' : ''}`);
			
			try {
				// Try to parse the config file as JSON with comments support
				this.config = this.parseJsonc(configContent);
				this.outputChannel.appendLine(`Focused Views: Parsed config: ${JSON.stringify(this.config, null, 2)}`);
				
				// Process each view to resolve file patterns
				if (this.config && this.config.views) {
					for (const viewId of Object.keys(this.config.views)) {
						const view = this.config.views[viewId];
						
						// Ensure view.files is an array
						if (!Array.isArray(view.files)) {
							view.files = [];
							this.outputChannel.appendLine(`Focused Views: No files array found for view '${viewId}'`);
							continue;
						}
						
						// Check if this view uses Git branch
						if (view.gitBranch && this.isGitAvailable) {
							this.outputChannel.appendLine(`Focused Views: Getting files from branch '${view.gitBranch}' for view '${viewId}'`);
							view.files = await this.getFilesFromBranch(view.gitBranch, view.files);
						} else {
							this.outputChannel.appendLine(`Focused Views: Resolving file patterns for view '${viewId}'`);
							view.files = this.resolveFilePatterns(view.files);
						}
						
						this.outputChannel.appendLine(`Focused Views: Resolved ${view.files.length} files for view '${viewId}'`);
					}
				}
			} catch (parseError) {
				const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
				this.outputChannel.appendLine(`Focused Views: Failed to parse config file: ${parseError}`);
				this.outputChannel.appendLine(`Focused Views: Error parsing configuration file: ${errorMessage}`);
				this.config = undefined;
			}
		} catch (readError) {
			const errorMessage = readError instanceof Error ? readError.message : 'Unknown error';
			this.outputChannel.appendLine(`Focused Views: Failed to read config file: ${readError}`);
			this.outputChannel.appendLine(`Focused Views: Error reading configuration file: ${errorMessage}`);
			this.config = undefined;
		}
	}

	/**
	 * Parse a JSON string with comments (jsonc)
	 * @param content The content to parse
	 * @returns The parsed JSON object
	 */
	private parseJsonc(content: string): Record<string, unknown> {
		// Remove comments for compatibility (simple implementation)
		// This is a simplified version and may not handle all edge cases
		const noComments = content
			.replace(/\/\/.*$/gm, '') // Remove single-line comments
			.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
		
		try {
			return JSON.parse(noComments);
		} catch (error) {
			this.outputChannel.appendLine(`Focused Views: JSON parse error: ${error}`);
			this.outputChannel.appendLine(`Focused Views: Problematic JSON content: ${noComments}`);
			throw error;
		}
	}

	public getBranchForView(viewId: string): string | undefined {
		if (!this.config || !this.config.views || !this.config.views[viewId]) {
			return undefined;
		}
		
		return this.config.views[viewId].gitBranch;
	}

	/**
	 * Check if direct edits are allowed for the given view
	 * @param viewId The ID of the view
	 * @returns true if direct edits are allowed, false otherwise
	 */
	public areDirectEditsAllowed(viewId: string): boolean {
		if (!this.config || !this.config.views || !this.config.views[viewId]) {
			return true; // Default to allowing edits if view is not found
		}
		
		const view = this.config.views[viewId];
		const options = view.options || {};
		
		// If allowDirectEdits is not specified, default to true
		return options.allowDirectEdits !== false;
	}

	/**
	 * Get the view ID for a file path
	 * @param filePath Path to the file
	 * @returns The view ID if the file belongs to a view, undefined otherwise
	 */
	public getViewIdForFile(filePath: string): string | undefined {
		if (!this.config || !this.config.views) {
			return undefined;
		}
		
		// Find the view that contains this file
		for (const [viewId, view] of Object.entries(this.config.views)) {
			if (view.files.includes(filePath)) {
				return viewId;
			}
		}
		
		return undefined;
	}

	/**
	 * Create a branch for editing a file from a view that doesn't allow direct edits
	 * @param viewId The ID of the view
	 * @param filePath Path to the file being edited
	 * @returns The name of the created branch, or undefined if branch creation failed
	 */
	public async createBranchForEdit(viewId: string, filePath: string): Promise<string | undefined> {
		if (!this.isGitAvailable || !this.workspaceRoot) {
			return undefined;
		}
		
		const view = this.config?.views?.[viewId];
		if (!view || !view.gitBranch) {
			return undefined;
		}
		
		const sourceBranch = view.gitBranch;
		const fileName = path.basename(filePath);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const newBranchName = `edit/${sourceBranch}/edit-${fileName}-${timestamp}`;
		
		try {
			// Create a new branch from the source branch
			await execAsync(`git checkout -b ${newBranchName} ${sourceBranch}`, { cwd: this.workspaceRoot });
			
			// Show a success message and return the branch name
			this.outputChannel.appendLine(`Created branch '${newBranchName}' for editing files from '${sourceBranch}'`);
			return newBranchName;
		} catch (error) {
			this.outputChannel.appendLine(`Error creating branch for edit: ${error}`);
			this.outputChannel.appendLine(`Failed to create branch for edit: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return undefined;
		}
	}

	/**
	 * Check if a file is from a branch different from the current one
	 * @param filePath Path to the file
	 * @returns true if the file is from a different branch, false otherwise
	 */
	public async isFileFromDifferentBranch(filePath: string): Promise<boolean> {
		if (!this.isGitAvailable || !this.workspaceRoot) {
			return false;
		}
		
		const viewId = this.getViewIdForFile(filePath);
		if (!viewId) {
			return false;
		}
		
		const viewBranch = this.getBranchForView(viewId);
		if (!viewBranch) {
			return false;
		}
		
		const currentBranch = await this.getCurrentGitBranch();
		return viewBranch !== currentBranch;
	}

	/**
	 * Convert a glob pattern to a RegExp
	 * This is a simplified version that handles basic glob patterns
	 */
	private convertGlobToRegExp(pattern: string): RegExp {
		// Escape special regex characters but keep the glob special characters
		let regexPattern = pattern
			.replace(/[.+^${}()|[\]\\]/g, '\\$&')
			.replace(/\?/g, '.')
			.replace(/\*/g, '.*');
		
		// Handle ** (globstar) patterns
		regexPattern = regexPattern.replace(/\.\*\.\*/g, '.*');
		
		// Make sure the pattern matches the whole string
		return new RegExp(`^${regexPattern}$`);
	}
}
