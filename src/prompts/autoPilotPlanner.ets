---
interface Props {
  message: string
  references: string | undefined
  tools: string[]
  exampleJson: any[]
}
---
<%= props.references %>
=======
User's request: <%= props.message %>

Think step by step to come up with a plan of action. 

Output Format schema - either a list of tools to invoke, if more information is needed:
{
  "plan": [ "your best guess on what to do next" ],
  "tools": [ { "name": "name of tool", "input": ["args"] } ]
}

Or a list of files to edit, if you are certain of how to fulfill the request:
{
  "plan": [ "array of steps of changes to make" ],
  "edits": {
    "path/to/file": "changes you want to make to each file"
  }
}

All tools you can use:
<%= props.tools.join('\n') %>

Some example plans based on the request provided:
<%= props.exampleJson.map(obj => JSON.stringify(obj)).join('\n\n') %>

Always follow this format. Your output: