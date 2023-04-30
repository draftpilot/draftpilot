---
interface Props {
  request: string
  diff: string
  compilerOutput: string
}
---
User's request: <%= props.request %>

This was the AI generated diff:
<%= props.diff %>

This was the compiler output:
<%= props.compilerOutput || 'no output (probably successful)' %>
-------
Point out any problems with the changes where it doesn't do what the user requested or has errors, and suggest any changes to make. Output in the following format:

If there are no problems:
{
  "result": "good",
  "comments: "Any notes to pass to the user in the pull request description"
}

If there are changes to make to fix issues or better match the user's request:
{
  "result": "rewrite",
  "path/to/file": "description of how this file should be changed, so an AI can modify it",
  ... more files ...
}

Your JSON output:
