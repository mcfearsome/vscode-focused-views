# Focused Views for VS Code

A Visual Studio Code extension that helps different roles in a team quickly focus on the files that matter to them. The extension creates a dedicated sidebar panel where team members can access curated sets of files based on their role or current task.

## Features

- **Role-based file organization**: Define custom views for different roles (frontend, backend, devops, etc.)
- **Smart file filtering**: Use glob patterns to include relevant files in each view
- **Git branch support**: Specify a dedicated git branch for each view to display files from different branches without switching
- **Customizable options**: Configure each view with options like file numbering, README display, and path formatting

## Configuration

Focused Views uses a configuration file at the root of your workspace. You can use any of these filenames:

- `.focusedviews.json` (Standard JSON)
- `.focusedviews.jsonc` (JSON with comments, recommended)
- `.focusedviews` (Backward compatibility)

### Example Configuration

```jsonc
// Example configuration for Focused Views extension
{
  // Configuration version
  "version": "1.0.0",
  
  // View definitions
  "views": {
    // Frontend developer view
    "frontend": {
      "name": "Frontend",
      "description": "UI components and client-side code",
      "files": [
        "src/ui/**/*.ts",
        "src/ui/**/*.tsx",
        "src/ui/**/*.css",
        "src/ui/**/*.scss",
        "public/**/*"
      ],
      "options": {
        "numberFiles": true,
        "viewReadme": true,
        "showFullPath": false,
        "showGitBranch": true,
        "collapseOnOpen": false
      }
    },
    
    // Backend developer view
    "backend": {
      "name": "Backend",
      "description": "Server-side code and APIs",
      "files": [
        "src/server/**/*.ts",
        "src/api/**/*.ts",
        "src/models/**/*.ts"
      ],
      "gitBranch": "develop",
      "options": {
        "showFullPath": true,
        "collapseOnOpen": true
      }
    }
  }
}
```

### Configuration Options

Each view can have the following options:

| Option | Description | Default |
|--------|-------------|---------|
| `numberFiles` | Number files in the view | `false` |
| `viewReadme` | Show README file at the top of the view | `false` |
| `showFullPath` | Show full path for files | `false` |
| `showGitBranch` | Show the git branch for this view | `true` |
| `collapseOnOpen` | Collapse this view when opening | `false` |
| `allowDirectEdits` | Allow direct editing of files from the specified branch | `false` |

### Git Branch Integration

This extension allows you to pull files from different Git branches without switching your working branch. This is especially useful for:

- Viewing code from different branches simultaneously
- Comparing implementations across branches
- Accessing reference code while working on a feature

### Branch Configuration

To display files from a specific branch, add the `gitBranch` property to a view:

```jsonc
"main": {
  "name": "Main Branch",
  "description": "Stable code from main branch",
  "files": ["src/**/*.ts"],
  "gitBranch": "main",
  "options": {
    "showGitBranch": true,
    "allowDirectEdits": false
  }
}
```

### Pull Request Workflow

When working with files from different branches, you can configure how edits are handled:

- `allowDirectEdits: true` - Allows direct editing of files from the specified branch
- `allowDirectEdits: false` - Creates a new branch for edits, enabling PR-based workflow

When `allowDirectEdits` is set to `false` and you attempt to edit a file:
1. The extension will prompt you to create a new branch
2. A branch will be created with the naming pattern `edit/{sourceBranch}/edit-{filename}-{timestamp}`
3. Your edits will be made on this new branch
4. You can use the "Focused Views: Create Pull Request" command to create a PR back to the source branch

This workflow helps maintain clean Git history and proper code review processes.

### Status Bar Integration

When working on an edit branch created by this extension, you'll see a status bar indicator showing the current branch. Click on it to:
- View information about the current edit branch
- Create a pull request back to the source branch

## Commands

The extension provides the following commands:

- `Focused Views: Refresh`: Refreshes the tree view to reflect changes in the configuration file.
- `Focused Views: Create Pull Request from Edit Branch`: Creates a pull request from the current edit branch back to its source branch.
- `Focused Views: Show Edit Branch Information`: Displays information about the current edit branch, including its source branch and purpose.
- `Focused Views: Create Sample Configuration File`: Creates a sample `.focusedviews.json` configuration file in your workspace root to help you get started.

## Troubleshooting

### Configuration File Not Found

If the extension cannot find your configuration file, try the following steps:

1. Make sure your configuration file is named `.focusedviews.json` or `focusedviews.json` and is located in the workspace root directory.
2. Use the `Focused Views: Create Sample Configuration File` command to create a sample configuration file in your workspace root.
3. Check the Output panel (select "Focused Views" from the dropdown) for detailed logs about the file detection process:
   - Open VS Code's Output panel using `View -> Output` or `Ctrl+Shift+U` (`Cmd+Shift+U` on macOS)
   - Select "Focused Views" from the dropdown menu in the Output panel
   - Review the detailed logs to see where the extension is looking for configuration files
4. If using JSON with comments, make sure it is properly formatted.
5. Restart VS Code after creating or editing the configuration file if changes are not being detected.

### Invalid Configuration

If your configuration file is detected but not loaded correctly:

1. Check the VS Code notifications for error messages about parsing the file.
2. Ensure your JSON is valid. You can use the JSON schema validation built into VS Code to help with this.
3. Look at the Output panel for more detailed error messages that might help identify the issue.

## Requirements

- Visual Studio Code 1.85.0 or later

## Installation

1. Install the extension from the VS Code marketplace
2. Create a `.focusedviews` file in the root of your workspace
3. Use the Focused Views panel in the sidebar

## License

MIT
