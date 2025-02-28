// Schema for .focusedviews configuration file
package focusedviews

// Top level schema definition
#Config: {
	// Version of the schema
	version: string | *"1.0.0"
	
	// Define all the views
	views: [viewName=string]: #View
}

// Definition of a focused view
#View: {
	// Human-readable name of the view
	name: string
	
	// Description of the view (optional)
	description?: string
	
	// Files that should be included in this view
	// Can be file paths or glob patterns
	files: [...string]
	
	// Git branch to focus on (optional)
	gitBranch?: string
	
	// Configuration options for this view
	options?: #ViewOptions
}

// Configuration options for a view
#ViewOptions: {
	// Number the files in the view
	numberFiles?: bool | *false
	
	// Show README file at the top of the view
	viewReadme?: bool | *false
	
	// Show full path for files
	showFullPath?: bool | *false
	
	// Show the git branch for this view
	showGitBranch?: bool | *true
	
	// Collapse this view when opening
	collapseOnOpen?: bool | *false
}

// Schema validation constraint
config: #Config
