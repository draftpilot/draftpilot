---
interface Props {
  references: string
  files: string
  exampleJson: string
}
---
Given the request in the prior messages, make the requested changes to the files using the JSON operation format described. If there are no edits to make, don't include that file. New files will be created.

Here is a list of files to edit.

<%= props.files %>

Related snippets within the codebase that may be helpful:

<%= props.references %>

---
This example shows all possible operations & thier inputs. ONLY use these operation types and arguments, follow it exactly. The line number and startLine should refer to the same line. Be mindful to insert code in the correct place (inside a class 
if it belongs there). With JSX, pay extra attention to where in the tree you are inserting, and get the line number correct. Errors will lead to bad code.

{
  "file/name": <%= props.exampleJson %>
}

Your return format is a JSON object with files as keys and arrays of operations as values. If the edit operations are long or require many changes, you can return the entire file as a string instead of array of operations.  
{
  "path/to/file": [edit operations],
  "path/to/newfile": "new file as a string",
  ...
}

Response JSON: