# Git Branch Integration Example

This example shows how to use Focused Views to display files from different Git branches without switching your working branch. This can be especially useful for:

1. Reviewing code that exists on a different branch
2. Comparing implementations across branches
3. Accessing reference code from a stable branch while working on a feature branch

## Configuration Example

Create a `.focusedviews.json` file in the root of your workspace with the following content:

```jsonc
{
  "version": "1.0.0",
  "views": {
    // View showing files from the main branch
    "main": {
      "name": "Main Branch Code",
      "description": "Stable code from the main branch",
      "files": [
        "src/**/*.ts"
      ],
      "gitBranch": "main",
      "options": {
        "showGitBranch": true
      }
    },
    
    // View showing files from your feature branch
    "feature": {
      "name": "Feature Implementation",
      "description": "Code from your feature branch",
      "files": [
        "src/**/*.ts"
      ],
      "gitBranch": "feature/new-feature",
      "options": {
        "showGitBranch": true
      }
    }
  }
}
```

## How It Works

1. The `gitBranch` property specifies which branch to pull files from
2. Files are matched using the glob patterns in the `files` array
3. The extension uses Git commands to list the files from the specified branch without checking it out
4. Setting `showGitBranch: true` in the options displays the branch name in the view title

## Benefits

- **No branch switching**: Access files from any branch without disrupting your current work
- **Side-by-side comparison**: View implementations across different branches simultaneously
- **Reference stable code**: Keep stable code from main branch as a reference while working on features
- **Code review**: Review code from pull requests by specifying their branch

## Requirements

- Git must be installed and available in your PATH
- Your workspace must be a Git repository
