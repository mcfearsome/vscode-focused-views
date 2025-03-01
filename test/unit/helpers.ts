import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';

/**
 * Creates a temporary directory for testing
 */
export function createTempDirectory(prefix: string = 'vscode-focused-views-test-'): string {
    const tempDir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
}

/**
 * Creates a mock file structure for testing
 */
export function createMockFileStructure(basePath: string, fileTree: Record<string, string | null>) {
    for (const [filePath, content] of Object.entries(fileTree)) {
        const fullPath = path.join(basePath, filePath);
        const dirname = path.dirname(fullPath);
        
        // Create directories
        fs.mkdirSync(dirname, { recursive: true });
        
        // Create file with content if not null
        if (content !== null) {
            fs.writeFileSync(fullPath, content || '');
        }
    }
}

/**
 * Initialize a Git repository in the given directory
 */
export function initGitRepo(repoPath: string) {
    const execSync = require('child_process').execSync;
    process.chdir(repoPath);
    
    // Initialize git repo
    execSync('git init', { cwd: repoPath });
    
    // Configure git user for tests
    execSync('git config user.email "test@example.com"', { cwd: repoPath });
    execSync('git config user.name "Test User"', { cwd: repoPath });
    
    // Initial commit
    execSync('git add .', { cwd: repoPath });
    execSync('git commit -m "Initial commit"', { cwd: repoPath });
    
    return repoPath;
}

/**
 * Creates a new branch in the git repository
 */
export function createGitBranch(repoPath: string, branchName: string) {
    const execSync = require('child_process').execSync;
    execSync(`git checkout -b ${branchName}`, { cwd: repoPath });
    return branchName;
}

/**
 * Restores all sinon stubs, mocks, and spies
 */
export function restoreAllSinon() {
    sinon.restore();
}

/**
 * Clean up temp directories and files after tests
 */
export function cleanupTempDirectories(directories: string[]) {
    for (const dir of directories) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (error) {
            console.error(`Failed to clean up directory ${dir}:`, error);
        }
    }
}