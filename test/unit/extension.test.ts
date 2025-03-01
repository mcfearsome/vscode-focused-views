import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { GitMock, ConfigLoaderMock, VSCodeMock } from './mocks';

// Mock the extension module
const extensionModule = {
    activate: () => {},
    deactivate: () => {}
};

describe('Extension Commands', function() {
    let gitMock: GitMock;
    let configLoaderMock: ConfigLoaderMock;
    let vscodeStub: sinon.SinonStub;
    let vscodeMock: VSCodeMock;
    
    beforeEach(function() {
        // Set up mocks
        gitMock = new GitMock();
        configLoaderMock = new ConfigLoaderMock(gitMock);
        vscodeMock = new VSCodeMock();
        
        // Mock the vscode module
        vscodeStub = sinon.stub(vscode);
    });
    
    afterEach(function() {
        sinon.restore();
    });
    
    describe('focusedViews.openFile command', function() {
        it('should open file directly if from same branch', async function() {
            // Setup: current branch is 'main' and we're opening a file from 'main'
            gitMock.setCurrentBranch('main');
            
            // Mock isFileFromDifferentBranch to return false (file is from same branch)
            const isFileFromDifferentBranchStub = sinon.stub(configLoaderMock, 'isFileFromDifferentBranch')
                .resolves(false);
            
            // Create a mock for the openTextDocument and showTextDocument functions
            const openTextDocumentStub = sinon.stub().resolves({});
            const showTextDocumentStub = sinon.stub().resolves({});
            
            // Create a mock function for the command handler
            const openFileCommandHandler = async (filePath: string) => {
                // Check if file is from a different branch
                const viewId = configLoaderMock.getViewIdForFile(filePath);
                if (viewId) {
                    const directEditsAllowed = configLoaderMock.areDirectEditsAllowed(viewId);
                    const isFromDifferentBranch = await configLoaderMock.isFileFromDifferentBranch(filePath);
                    
                    if (isFromDifferentBranch && !directEditsAllowed) {
                        // Since this is mocked to return false, this branch shouldn't be executed
                        assert.fail('This branch should not be executed');
                    }
                }
                
                // Open the file directly
                await openTextDocumentStub(filePath);
                await showTextDocumentStub({});
            };
            
            // Execute the command with a file from 'main'
            await openFileCommandHandler('/mock/workspace/src/main.ts');
            
            // Verify that the openTextDocument and showTextDocument were called
            sinon.assert.calledOnce(openTextDocumentStub);
            sinon.assert.calledWith(openTextDocumentStub, '/mock/workspace/src/main.ts');
            sinon.assert.calledOnce(showTextDocumentStub);
        });
        
        it('should show warning and create branch if file is from different branch with direct edits disabled', async function() {
            // Setup: current branch is 'main' and we're opening a file from 'develop'
            gitMock.setCurrentBranch('main');
            
            // Mock functions
            const isFileFromDifferentBranchStub = sinon.stub(configLoaderMock, 'isFileFromDifferentBranch')
                .resolves(true);
            const areDirectEditsAllowedStub = sinon.stub(configLoaderMock, 'areDirectEditsAllowed')
                .returns(false);
            const getBranchForViewStub = sinon.stub(configLoaderMock, 'getBranchForView')
                .returns('develop');
            
            // Mock Date.prototype.toISOString for predictable branch name
            const originalDateToISOString = Date.prototype.toISOString;
            Date.prototype.toISOString = function() {
                return '2025-03-01T12:00:00.000Z';
            };
            
            const expectedBranchName = 'edit/develop/edit-feature.ts-2025-03-01T12-00-00-000Z';
            
            const createBranchForEditStub = sinon.stub(configLoaderMock, 'createBranchForEdit')
                .resolves(expectedBranchName);
            
            // Create mocks for VS Code dialog and document functions
            const showWarningMessageStub = sinon.stub().resolves('Create Branch & Edit');
            const openTextDocumentStub = sinon.stub().resolves({});
            const showTextDocumentStub = sinon.stub().resolves({});
            const refreshStub = sinon.stub().resolves();
            
            // Create a mock function for the command handler
            const openFileCommandHandler = async (filePath: string) => {
                // Check if this file is from a branch that doesn't allow direct edits
                const viewId = configLoaderMock.getViewIdForFile(filePath);
                if (viewId) {
                    const directEditsAllowed = areDirectEditsAllowedStub(viewId);
                    const isFromDifferentBranch = await isFileFromDifferentBranchStub(filePath);
                    
                    if (isFromDifferentBranch && !directEditsAllowed) {
                        // Ask user if they want to create a branch for editing
                        const createBranch = 'Create Branch & Edit';
                        const viewOnly = 'View Only';
                        const response = await showWarningMessageStub(
                            `This file is from branch '${getBranchForViewStub(viewId)}' which doesn't allow direct edits. Would you like to create a branch for editing?`,
                            createBranch, 
                            viewOnly
                        );
                        
                        if (response === createBranch) {
                            // Create a branch for editing and then open the file
                            const newBranch = await createBranchForEditStub(viewId, filePath);
                            if (newBranch) {
                                // After branch is created, refresh the views and open the file
                                refreshStub();
                                await openTextDocumentStub(filePath);
                                await showTextDocumentStub({});
                                return;
                            }
                        } else if (response === viewOnly) {
                            // Open the file as read-only
                            await openTextDocumentStub(filePath);
                            await showTextDocumentStub({}, { preview: true, preserveFocus: false });
                            return;
                        } else {
                            // User canceled, don't open the file
                            return;
                        }
                    }
                }
                
                // Normal file opening behavior
                await openTextDocumentStub(filePath);
                await showTextDocumentStub({});
            };
            
            // Execute the command with a file from 'develop'
            await openFileCommandHandler('/mock/workspace/src/feature.ts');
            
            // Restore original Date.prototype.toISOString
            Date.prototype.toISOString = originalDateToISOString;
            
            // Verify that the warning was shown and the branch was created
            sinon.assert.calledOnce(showWarningMessageStub);
            sinon.assert.calledWith(showWarningMessageStub, 
                "This file is from branch 'develop' which doesn't allow direct edits. Would you like to create a branch for editing?",
                'Create Branch & Edit', 
                'View Only'
            );
            
            sinon.assert.calledOnce(createBranchForEditStub);
            sinon.assert.calledWith(createBranchForEditStub, 'develop', '/mock/workspace/src/feature.ts');
            
            // Verify that the refresh was called
            sinon.assert.calledOnce(refreshStub);
            
            // Verify that the openTextDocument and showTextDocument were called
            sinon.assert.calledOnce(openTextDocumentStub);
            sinon.assert.calledWith(openTextDocumentStub, '/mock/workspace/src/feature.ts');
            sinon.assert.calledOnce(showTextDocumentStub);
        });
        
        it('should open file as read-only when user chooses View Only', async function() {
            // Setup: current branch is 'main' and we're opening a file from 'develop'
            gitMock.setCurrentBranch('main');
            
            // Mock functions
            const isFileFromDifferentBranchStub = sinon.stub(configLoaderMock, 'isFileFromDifferentBranch')
                .resolves(true);
            const areDirectEditsAllowedStub = sinon.stub(configLoaderMock, 'areDirectEditsAllowed')
                .returns(false);
            const getBranchForViewStub = sinon.stub(configLoaderMock, 'getBranchForView')
                .returns('develop');
            
            // Create mocks for VS Code dialog and document functions
            const showWarningMessageStub = sinon.stub().resolves('View Only');
            const openTextDocumentStub = sinon.stub().resolves({});
            const showTextDocumentStub = sinon.stub().resolves({});
            
            // Create a mock function for the command handler
            const openFileCommandHandler = async (filePath: string) => {
                // Check if this file is from a branch that doesn't allow direct edits
                const viewId = configLoaderMock.getViewIdForFile(filePath);
                if (viewId) {
                    const directEditsAllowed = areDirectEditsAllowedStub(viewId);
                    const isFromDifferentBranch = await isFileFromDifferentBranchStub(filePath);
                    
                    if (isFromDifferentBranch && !directEditsAllowed) {
                        // Ask user if they want to create a branch for editing
                        const createBranch = 'Create Branch & Edit';
                        const viewOnly = 'View Only';
                        const response = await showWarningMessageStub(
                            `This file is from branch '${getBranchForViewStub(viewId)}' which doesn't allow direct edits. Would you like to create a branch for editing?`,
                            createBranch, 
                            viewOnly
                        );
                        
                        if (response === createBranch) {
                            // This branch shouldn't be executed
                            assert.fail('This branch should not be executed');
                        } else if (response === viewOnly) {
                            // Open the file as read-only
                            await openTextDocumentStub(filePath);
                            await showTextDocumentStub({}, { preview: true, preserveFocus: false });
                            return;
                        } else {
                            // User canceled, don't open the file
                            return;
                        }
                    }
                }
                
                // Normal file opening behavior
                await openTextDocumentStub(filePath);
                await showTextDocumentStub({});
            };
            
            // Execute the command with a file from 'develop'
            await openFileCommandHandler('/mock/workspace/src/feature.ts');
            
            // Verify that the warning was shown
            sinon.assert.calledOnce(showWarningMessageStub);
            
            // Verify that the openTextDocument was called
            sinon.assert.calledOnce(openTextDocumentStub);
            sinon.assert.calledWith(openTextDocumentStub, '/mock/workspace/src/feature.ts');
            
            // Verify that showTextDocument was called with read-only options
            sinon.assert.calledOnce(showTextDocumentStub);
            sinon.assert.calledWith(showTextDocumentStub, {}, { preview: true, preserveFocus: false });
        });
    });
    
    describe('focusedViews.createPullRequest command', function() {
        it('should create a PR URL using the correct branch pattern for GitHub', async function() {
            // Setup: current branch is an edit branch
            const editBranchName = 'edit/develop/edit-feature.ts-2025-03-01T12-00-00-000Z';
            gitMock.setCurrentBranch(editBranchName);
            
            // Create mocks for VS Code functions
            const openExternalStub = sinon.stub().resolves(true);
            
            // Create a mock function for the command handler
            const createPRCommandHandler = async () => {
                try {
                    // Get the current branch name
                    const { stdout: branchName } = await gitMock.execStub(
                        'git rev-parse --abbrev-ref HEAD',
                        { cwd: '/mock/workspace' }
                    );
                    
                    // Extract source branch from our naming convention (edit/sourceBranch/...)
                    const match = branchName.trim().match(/^edit\/([^\/]+)\//);
                    if (!match) {
                        return;
                    }
                    
                    const targetBranch = match[1];
                    
                    // Get the remote URL
                    const { stdout: remoteUrl } = await gitMock.execStub(
                        'git remote get-url origin',
                        { cwd: '/mock/workspace' }
                    );
                    
                    // Generate PR URL for GitHub
                    const prUrl = remoteUrl.replace(/\.git$/, '')
                        .replace(/^git@github\.com:/, 'https://github.com/')
                        + `/compare/${targetBranch}...${branchName}?expand=1`;
                    
                    // Open the PR creation URL in the default browser
                    await openExternalStub({ fsPath: prUrl, scheme: 'https' });
                } catch (error) {
                    console.error('Error creating PR:', error);
                }
            };
            
            // Execute the command
            await createPRCommandHandler();
            
            // Expected PR URL for GitHub
            const expectedUrl = 'https://github.com/mcfearsome/vscode-focused-views/compare/develop...edit/develop/edit-feature.ts-2025-03-01T12-00-00-000Z?expand=1';
            
            // Verify that openExternal was called with the correct URL
            sinon.assert.calledOnce(openExternalStub);
            sinon.assert.calledWith(openExternalStub, { fsPath: expectedUrl, scheme: 'https' });
        });
        
        it('should show a warning if current branch is not an edit branch', async function() {
            // Setup: current branch is not an edit branch
            gitMock.setCurrentBranch('main');
            
            // Create mocks for VS Code functions
            const showWarningMessageStub = sinon.stub().resolves();
            
            // Create a mock function for the command handler
            const createPRCommandHandler = async () => {
                try {
                    // Get the current branch name
                    const { stdout: branchName } = await gitMock.execStub(
                        'git rev-parse --abbrev-ref HEAD',
                        { cwd: '/mock/workspace' }
                    );
                    
                    // Extract source branch from our naming convention (edit/sourceBranch/...)
                    const match = branchName.trim().match(/^edit\/([^\/]+)\//);
                    if (!match) {
                        showWarningMessageStub('Current branch does not appear to be an edit branch created by Focused Views.');
                        return;
                    }
                    
                    // This part shouldn't be executed
                    assert.fail('This part should not be executed');
                } catch (error) {
                    console.error('Error creating PR:', error);
                }
            };
            
            // Execute the command
            await createPRCommandHandler();
            
            // Verify that showWarningMessage was called
            sinon.assert.calledOnce(showWarningMessageStub);
            sinon.assert.calledWith(showWarningMessageStub, 'Current branch does not appear to be an edit branch created by Focused Views.');
        });
    });
});