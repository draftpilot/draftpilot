---
interface Props {
  message: string
  plan: string[]
  toolResults: string[]
}
---
User's request: <%= props.message %>

Your previous plan of action:
<%= props.plan.join('\n') %>

Here are the results of the tools you invoked:
<%= props.toolResults.join('\n\n') %>

------------
Think step by step to come up with a plan of action.

Output Format schema - list of files to edit:
{
  "plan": [ "array of steps of changes to make" ],
  "edits": {
    "path/to/file": "detailed summary of changes the AI should make"
  }
}

OR if you are not able to fulfill the request, return:
{
  "failure": "reason why you cannot fulfill the request"
}

Always follow this JSON format. Your output: