# Focused Views Tests

This directory contains the tests for the VS Code Focused Views extension.

## Test Structure

- `unit/`: Unit tests for individual components
  - `configLoader.test.ts`: Tests for the ConfigLoader class which handles Git branch operations
  - `extension.test.ts`: Tests for the extension commands and functionality
  - `mocks.ts`: Mock implementations of VS Code APIs and Git functionality
  - `helpers.ts`: Helper utilities for testing

## Running Tests

To run the tests:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit
```

## Test Implementation Details

### Mock System

The tests use Sinon for mocking and stubbing functionality. The following components are mocked:

- **VS Code API**: The VS Code extension API is mocked in `VSCodeMock` to simulate VS Code's behavior without requiring a VS Code instance.
- **Git Operations**: Git operations are mocked in `GitMock` to simulate Git behavior without requiring a real Git repository.
- **ConfigLoader**: The ConfigLoader class is mocked to provide controlled test environments.

### Test Coverage

The tests focus on the following functionality:

1. **Branch-specific file operations**:
   - Detecting if a file is from a different branch
   - Creating a new branch for editing files from a branch that doesn't allow direct edits
   - Getting files from branches without switching to them

2. **File editing workflow**:
   - Opening files from the same branch
   - Opening files from a different branch with direct edits allowed
   - Opening files from a different branch with direct edits disabled
   - Creating a new branch for editing
   - Opening files in read-only mode

3. **Pull Request workflow**:
   - Creating a PR from an edit branch back to the source branch
   - Handling non-edit branches correctly
   - Properly forming GitHub PR URLs

## Adding New Tests

When adding new tests, follow these guidelines:

1. Use descriptive test names that explain what functionality is being tested
2. Set up the necessary mocks in the beforeEach and clean up in afterEach
3. Verify that your mocks simulate the real behavior accurately
4. Test both success and failure cases
5. Use assertions to verify the expected behavior