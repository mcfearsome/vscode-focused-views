import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

/**
 * Mock for VS Code API
 */
export class VSCodeMock {
    public window: any;
    public workspace: any;
    public commands: any;
    public Uri: any;
    public env: any;
    public EventEmitter: any;
    public OutputChannel: any;
    public StatusBarItem: any;
    public TreeItem: any;
    public TreeItemCollapsibleState: any;

    constructor() {
        // Mock window
        this.window = {
            showInformationMessage: sinon.stub().resolves(),
            showWarningMessage: sinon.stub().resolves(),
            showErrorMessage: sinon.stub().resolves(),
            createOutputChannel: sinon.stub().returns({
                appendLine: sinon.stub(),
                show: sinon.stub(),
                clear: sinon.stub(),
                dispose: sinon.stub()
            }),
            createStatusBarItem: sinon.stub().returns({
                text: '',
                tooltip: '',
                command: '',
                show: sinon.stub(),
                hide: sinon.stub(),
                dispose: sinon.stub()
            }),
            showTextDocument: sinon.stub().resolves(),
            registerTreeDataProvider: sinon.stub().returns({
                dispose: sinon.stub()
            }),
        };

        // Mock workspace
        this.workspace = {
            workspaceFolders: [
                { uri: { fsPath: '/mock/workspace' } }
            ],
            openTextDocument: sinon.stub().resolves({
                getText: sinon.stub().returns(''),
                fileName: '',
                isDirty: false,
                save: sinon.stub().resolves(true)
            }),
            createFileSystemWatcher: sinon.stub().returns({
                onDidChange: sinon.stub().returns({ dispose: sinon.stub() }),
                onDidCreate: sinon.stub().returns({ dispose: sinon.stub() }),
                onDidDelete: sinon.stub().returns({ dispose: sinon.stub() }),
                dispose: sinon.stub()
            }),
            onDidSaveTextDocument: sinon.stub().returns({ dispose: sinon.stub() })
        };

        // Mock commands
        this.commands = {
            registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
            executeCommand: sinon.stub().resolves()
        };

        // Mock Uri
        this.Uri = {
            file: (path: string) => ({ fsPath: path, scheme: 'file' }),
            parse: (path: string) => ({ fsPath: path, scheme: 'file' })
        };

        // Mock env
        this.env = {
            openExternal: sinon.stub().resolves()
        };

        // Mock EventEmitter
        this.EventEmitter = class MockEventEmitter extends EventEmitter {
            public event: any;
            constructor() {
                super();
                const fire = (...args: any[]) => {
                    this.emit('event', ...args);
                };
                this.event = (listener: any) => {
                    this.on('event', listener);
                    return { dispose: () => this.removeListener('event', listener) };
                };
                this.fire = fire;
            }
            fire: any;
        };

        // Mock TreeItemCollapsibleState
        this.TreeItemCollapsibleState = {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        };
    }

    reset() {
        sinon.reset();
    }
}

/**
 * Mock for Git functionality
 */
export class GitMock {
    private gitDir: string;
    private branches: string[] = ['main', 'develop'];
    private currentBranch: string = 'main';
    private filesInBranches: { [key: string]: string[] } = {
        'main': [
            'src/main.ts',
            'src/utils.ts',
            'README.md'
        ],
        'develop': [
            'src/main.ts',
            'src/utils.ts',
            'src/feature.ts',
            'README.md'
        ]
    };
    public execStub: sinon.SinonStub;

    constructor(gitDir: string = '/mock/git') {
        this.gitDir = gitDir;
        this.execStub = sinon.stub();
        this.setupExecStub();
    }

    private setupExecStub() {
        // Mock git --version
        this.execStub.withArgs('git --version', { cwd: sinon.match.any })
            .resolves({ stdout: 'git version 2.39.1', stderr: '' });

        // Mock git rev-parse --is-inside-work-tree
        this.execStub.withArgs('git rev-parse --is-inside-work-tree', { cwd: sinon.match.any })
            .resolves({ stdout: 'true', stderr: '' });

        // Mock git rev-parse --abbrev-ref HEAD (get current branch)
        this.execStub.withArgs('git rev-parse --abbrev-ref HEAD', { cwd: sinon.match.any })
            .callsFake(() => {
                return Promise.resolve({ stdout: this.currentBranch, stderr: '' });
            });

        // Mock git ls-tree -r --name-only <branch> (list files in a branch)
        this.execStub.withArgs(sinon.match(/git ls-tree -r --name-only .+/), { cwd: sinon.match.any })
            .callsFake((cmd: string) => {
                const branch = cmd.split(' ').pop();
                if (branch && this.filesInBranches[branch]) {
                    return Promise.resolve({ stdout: this.filesInBranches[branch].join('\n'), stderr: '' });
                }
                return Promise.reject(new Error(`Branch not found: ${branch}`));
            });

        // Mock git checkout -b (create new branch)
        this.execStub.withArgs(sinon.match(/git checkout -b .+/), { cwd: sinon.match.any })
            .callsFake((cmd: string) => {
                const args = cmd.split(' ');
                const newBranch = args[3];
                const sourceBranch = args[4];

                if (!this.branches.includes(sourceBranch)) {
                    return Promise.reject(new Error(`Source branch not found: ${sourceBranch}`));
                }

                this.branches.push(newBranch);
                this.currentBranch = newBranch;
                this.filesInBranches[newBranch] = [...this.filesInBranches[sourceBranch]];

                return Promise.resolve({ stdout: `Switched to a new branch '${newBranch}'`, stderr: '' });
            });

        // Mock git remote get-url origin
        this.execStub.withArgs('git remote get-url origin', { cwd: sinon.match.any })
            .resolves({ stdout: 'https://github.com/mcfearsome/vscode-focused-views.git', stderr: '' });
    }

    reset() {
        this.branches = ['main', 'develop'];
        this.currentBranch = 'main';
        this.filesInBranches = {
            'main': [
                'src/main.ts',
                'src/utils.ts',
                'README.md'
            ],
            'develop': [
                'src/main.ts',
                'src/utils.ts',
                'src/feature.ts',
                'README.md'
            ]
        };
        this.execStub.reset();
        this.setupExecStub();
    }

    setCurrentBranch(branch: string) {
        if (!this.branches.includes(branch)) {
            this.branches.push(branch);
            this.filesInBranches[branch] = [...this.filesInBranches['main']];
        }
        this.currentBranch = branch;
    }

    addFileToBranch(branch: string, filePath: string) {
        if (!this.branches.includes(branch)) {
            throw new Error(`Branch not found: ${branch}`);
        }
        if (!this.filesInBranches[branch].includes(filePath)) {
            this.filesInBranches[branch].push(filePath);
        }
    }

    removeFileFromBranch(branch: string, filePath: string) {
        if (!this.branches.includes(branch)) {
            throw new Error(`Branch not found: ${branch}`);
        }
        this.filesInBranches[branch] = this.filesInBranches[branch].filter(f => f !== filePath);
    }
}

/**
 * Mock for ConfigLoader
 */
export class ConfigLoaderMock {
    private config: any;
    private isGitAvailable: boolean = true;
    private mockOutputChannel: any;
    private gitMock: GitMock;

    constructor(gitMock: GitMock) {
        this.gitMock = gitMock;
        this.mockOutputChannel = {
            appendLine: sinon.stub(),
            show: sinon.stub(),
            clear: sinon.stub(),
            dispose: sinon.stub()
        };

        this.config = {
            version: '1.0.0',
            views: {
                'main': {
                    name: 'Main',
                    description: 'Main branch files',
                    files: [
                        '/mock/workspace/src/main.ts',
                        '/mock/workspace/src/utils.ts',
                        '/mock/workspace/README.md'
                    ],
                    gitBranch: 'main',
                    options: {
                        allowDirectEdits: true
                    }
                },
                'develop': {
                    name: 'Dev',
                    description: 'Development branch files',
                    files: [
                        '/mock/workspace/src/main.ts',
                        '/mock/workspace/src/utils.ts',
                        '/mock/workspace/src/feature.ts',
                        '/mock/workspace/README.md'
                    ],
                    gitBranch: 'develop',
                    options: {
                        allowDirectEdits: false
                    }
                }
            }
        };
    }

    getConfig() {
        return this.config;
    }

    getViews() {
        return this.config.views;
    }

    async refresh() {
        // Mock implementation
    }

    async getCurrentGitBranch() {
        const { stdout } = await this.gitMock.execStub('git rev-parse --abbrev-ref HEAD', { cwd: '/mock/workspace' });
        return stdout;
    }

    async getFilesFromBranch(branch: string, patterns: string[]) {
        const { stdout } = await this.gitMock.execStub(`git ls-tree -r --name-only ${branch}`, { cwd: '/mock/workspace' });
        return stdout.split('\n').filter(Boolean).map(file => path.join('/mock/workspace', file));
    }

    getBranchForView(viewId: string) {
        return this.config.views[viewId]?.gitBranch;
    }

    areDirectEditsAllowed(viewId: string) {
        const view = this.config.views[viewId];
        if (!view) return true;
        return view.options?.allowDirectEdits !== false;
    }

    getViewIdForFile(filePath: string) {
        for (const [viewId, view] of Object.entries(this.config.views)) {
            if ((view as any).files.includes(filePath)) {
                return viewId;
            }
        }
        return undefined;
    }

    async createBranchForEdit(viewId: string, filePath: string) {
        const view = this.config.views[viewId];
        if (!view || !view.gitBranch) return undefined;

        const sourceBranch = view.gitBranch;
        const fileName = path.basename(filePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newBranchName = `edit/${sourceBranch}/edit-${fileName}-${timestamp}`;

        await this.gitMock.execStub(`git checkout -b ${newBranchName} ${sourceBranch}`, { cwd: '/mock/workspace' });
        return newBranchName;
    }

    async isFileFromDifferentBranch(filePath: string) {
        const viewId = this.getViewIdForFile(filePath);
        if (!viewId) return false;

        const viewBranch = this.getBranchForView(viewId);
        if (!viewBranch) return false;

        const currentBranch = await this.getCurrentGitBranch();
        return viewBranch !== currentBranch;
    }
}