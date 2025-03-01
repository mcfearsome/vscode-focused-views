import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';
import { GitMock, ConfigLoaderMock } from './mocks';
import { promisify } from 'util';

describe('ConfigLoader Branch Operations', function() {
    let gitMock: GitMock;
    let configLoader: ConfigLoaderMock;

    beforeEach(function() {
        gitMock = new GitMock();
        configLoader = new ConfigLoaderMock(gitMock);
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('isFileFromDifferentBranch', function() {
        it('should return true if file is from a different branch', async function() {
            // Set current branch to 'main'
            gitMock.setCurrentBranch('main');
            
            // Check a file from 'develop' view
            const result = await configLoader.isFileFromDifferentBranch('/mock/workspace/src/feature.ts');
            
            assert.strictEqual(result, true);
        });

        it('should return false if file is from the current branch', async function() {
            // Set current branch to 'develop'
            gitMock.setCurrentBranch('develop');
            
            // Check a file from 'develop' view
            const result = await configLoader.isFileFromDifferentBranch('/mock/workspace/src/feature.ts');
            
            assert.strictEqual(result, false);
        });

        it('should return false if file is not found in any view', async function() {
            const result = await configLoader.isFileFromDifferentBranch('/mock/workspace/nonexistent.ts');
            
            assert.strictEqual(result, false);
        });
    });

    describe('createBranchForEdit', function() {
        it('should create a branch with the correct naming pattern', async function() {
            // Mock Date.prototype.toISOString to return a fixed timestamp
            const originalDateToISOString = Date.prototype.toISOString;
            Date.prototype.toISOString = function() {
                return '2025-03-01T12:00:00.000Z';
            };

            const filePath = '/mock/workspace/src/feature.ts';
            const newBranch = await configLoader.createBranchForEdit('develop', filePath);
            
            // Restore original Date.prototype.toISOString
            Date.prototype.toISOString = originalDateToISOString;
            
            // Verify branch name follows the pattern: edit/{sourceBranch}/edit-{filename}-{timestamp}
            assert.strictEqual(newBranch, 'edit/develop/edit-feature.ts-2025-03-01T12-00-00-000Z');
            
            // Verify git checkout command was called with correct arguments
            sinon.assert.calledWith(
                gitMock.execStub,
                `git checkout -b ${newBranch} develop`,
                { cwd: '/mock/workspace' }
            );
        });
        
        it('should return undefined if gitBranch is not specified for the view', async function() {
            // Create a mock config without gitBranch
            const originalConfig = configLoader.getConfig();
            const modifiedConfig = JSON.parse(JSON.stringify(originalConfig));
            delete modifiedConfig.views.develop.gitBranch;
            
            // Use sinon to replace getConfig method
            sinon.replace(configLoader, 'getConfig', () => modifiedConfig);
            sinon.replace(configLoader, 'getBranchForView', () => undefined);
            
            const result = await configLoader.createBranchForEdit('develop', '/mock/workspace/src/feature.ts');
            
            assert.strictEqual(result, undefined);
        });
    });
    
    describe('getFilesFromBranch', function() {
        it('should return files from the current branch if branch matches current', async function() {
            // Set current branch to 'main'
            gitMock.setCurrentBranch('main');
            
            const files = await configLoader.getFilesFromBranch('main', ['src/**/*.ts']);
            
            // Verify the files list includes the expected files
            assert.deepStrictEqual(files, [
                '/mock/workspace/src/main.ts',
                '/mock/workspace/src/utils.ts'
            ]);
        });
        
        it('should return files from a different branch', async function() {
            // Set current branch to 'main'
            gitMock.setCurrentBranch('main');
            
            const files = await configLoader.getFilesFromBranch('develop', ['src/**/*.ts']);
            
            // Verify we get the files from 'develop' branch
            assert.deepStrictEqual(files, [
                '/mock/workspace/src/main.ts',
                '/mock/workspace/src/utils.ts',
                '/mock/workspace/src/feature.ts'
            ]);
            
            // Verify git ls-tree command was called with correct arguments
            sinon.assert.calledWith(
                gitMock.execStub,
                'git ls-tree -r --name-only develop',
                { cwd: '/mock/workspace' }
            );
        });
    });
    
    describe('areDirectEditsAllowed', function() {
        it('should return true if allowDirectEdits is true', function() {
            const result = configLoader.areDirectEditsAllowed('main');
            assert.strictEqual(result, true);
        });
        
        it('should return false if allowDirectEdits is false', function() {
            const result = configLoader.areDirectEditsAllowed('develop');
            assert.strictEqual(result, false);
        });
        
        it('should return true if view is not found', function() {
            const result = configLoader.areDirectEditsAllowed('nonexistent');
            assert.strictEqual(result, true);
        });
    });
});