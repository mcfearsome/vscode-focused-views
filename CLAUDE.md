# VS Code Focused Views Development Guide

## Build & Development Commands
- `npm run compile` - Compile the extension
- `npm run watch` - Watch for changes and recompile
- `npm run package` - Package for distribution
- `npm run lint` - Run ESLint on src files
- `npm run vscode:prepublish` - Prepare for publishing

## Project Structure
- `src/` - TypeScript source files
- `schemas/` - JSON schema definitions
- `examples/` - Example configuration files
- `media/` - Static assets

## Code Style Guidelines
- Use strict TypeScript typing with interfaces for all data structures
- Import statements should be grouped: vscode first, then node modules, then local modules
- Error handling should use try/catch with specific error messages and logging to outputChannel
- Use async/await pattern for asynchronous operations
- Follow camelCase for variables/methods, PascalCase for classes/interfaces
- Extract repeated logic into helper methods
- Use dependency injection for components that need shared services
- Comment complex sections of code, especially regex or business logic