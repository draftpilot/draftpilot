---
interface Props {
  message: string
  references: string[]
  tools: string[]
  exampleJson: any[]
}
---
<%= props.references.join('\n\n') %>
=======
User's request: <%= props.message %>

Think step by step to come up with a plan of action. ALWAYS follow this JSON schema.

Output Format schema - either a list of tools to invoke and files to read:
{
  "plan": [ "your best guess on what to do next" ],
  "tools": [ { "name": "name of tool", "input": ["args"] } ]
}

Or a list of files to edit, if you have all the context you need to fulfill the request:
{
  "plan": [ "array of steps of changes to make" ],
  "edits": {
    "path/to/file": "changes you want to make to each file"
  }
}

If you are not able to fulfill the request:
{
  "failure": "reason why you cannot fulfill the request"
}

All tools you can use:
<%= props.tools.join('\n') %>

Some example plans based on the request provided:
<%= props.exampleJson.map(obj => JSON.stringify(obj)).join('\n\n') %>

Always follow this format. Your output: