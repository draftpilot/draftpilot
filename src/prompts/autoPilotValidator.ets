---
interface Props {
  request: string
  plan: string
  diff: string
  compilerOutput: string | null
}
---
User's request: <%= props.request %>

AI Plan:
<%= props.plan %>

AI generated changes:
<%= props.diff %>

<%= props.compilerOutput ? 'This was the compiler output:\n' + 
  (props.compilerOutput|| 'no output (probably successful)') : '' %>
-------
Point out any problems with the generated code where it doesn't do what the user requested or has errors, and suggest any changes to make. Output in the following format:

If there are no problems:
{
  "result": "good",
  "comments: "Any notes to pass to the user in a PR comment, e.g. what else needs to be done"
}

If there are changes to make to fix issues or better match the user's request, use this format.
The keys are each file that you want to change (on top of the existing diff above), the value
is the change to make to that file. Every file to change must be in the list.

When requesting changes, you need to specify exactly how to change the file. Don't say "fix the import", say "import x from y". Don't say "pass the correct options object", say "pass {x: 1, y: 2}".
{
  "result": "rewrite",
  "path/to/file": "detailed summary of changes the AI should make, e.g. change the call() on line 5 to callMe()",
  ... more files ...
}

Your JSON output:
