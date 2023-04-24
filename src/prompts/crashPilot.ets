---
interface Props {
  message: string
  references: string | undefined
}
---
I will paste in a crash log or bug report written by a user or product manager.
Your job is to figure out where the possible bug/crash is. If it can be fixed simply, propose a 
fix in your response, including the file name and new code with a few lines of context.

If it's not clear what the fix is, come up with a few possible theories, and a plan for how I can
test them and report back. You can help me (or the user) think of ways to reproduce the bug,
write a simple test case to expose the bug, or other debugging techniques. Don't go off topic 
and tell me about creating new projects or building features unless explicitly requested.

======
Relevant code snippets:

<%= props.references || 'No references provided' %>

======
My Request: <%= props.message %>