# Focused Views for VS Code

A Visual Studio Code extension that helps different roles in a team quickly focus on the files that matter to them. The extension creates a dedicated sidebar panel where team members can access curated sets of files based on their role or current task.

## Features

- **Role-based file organization**: Define custom views for different roles (frontend, backend, devops, etc.)
- **Smart file filtering**: Use glob patterns to include relevant files in each view
- **Git branch support**: Specify a dedicated git branch for each view
- **Customizable options**: Configure each view with options like file numbering, README display, and path formatting

## Configuration

Focused Views uses a `.focusedviews` configuration file in CUE language format at the root of your workspace.

### Example Configuration

```cue
// Example configuration for Focused Views extension
package focusedviews

config: {
	version: "1.0.0"
	views: {
		// Frontend developer view
		frontend: {
			name: "Frontend"
			description: "UI components and client-side code"
			files: [
				"src/ui/**/*.ts",
				"src/ui/**/*.tsx",
				"src/ui/**/*.css",
				"src/ui/**/*.scss",
				"public/**/*"
			]
			options: {
				numberFiles: true
				viewReadme: true
				showFullPath: false
				showGitBranch: true
				collapseOnOpen: false
			}
		}
		
		// Backend developer view
		backend: {
			name: "Backend"
			description: "Server-side code and APIs"
			files: [
				"src/server/**/*.ts",
				"src/api/**/*.ts",
				"src/models/**/*.ts"
			]
			gitBranch: "develop"
			options: {
				showFullPath: true
				collapseOnOpen: true
			}
		}
		
		// DevOps view
		devops: {
			name: "DevOps"
			description: "Configuration and deployment files"
			files: [
				"Dockerfile",
				"docker-compose.yml",
				".github/workflows/**/*",
				"scripts/**/*.sh",
				"config/**/*.json"
			]
			options: {
				viewReadme: true
				showGitBranch: false
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

## Requirements

- Visual Studio Code 1.85.0 or later
- CUE Language must be installed to validate configuration files

## Installation

1. Install the extension from the VS Code marketplace
2. Create a `.focusedviews` file in the root of your workspace
3. Use the Focused Views panel in the sidebar

## Troubleshooting

If the extension does not load your configuration:

1. Check that the `.focusedviews` file exists in the root of your workspace
2. Verify that the CUE syntax is valid
3. Use the refresh button in the Focused Views panel to reload the configuration

## License

MIT
