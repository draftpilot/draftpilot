---
interface Props {
  message: string
  files: string
  exampleJson: string
}
---
Given the request in the prior messages, make the requested changes to the files using the JSON operation format described. If there are no edits to make, don't include that file. New files will be created.

Here is a list of files.
<%= props.files %>

---
This example shows all possible operations & thier inputs: <%= props.exampleJson %>

Your return format is a JSON object with files as keys and arrays of operations as values:
{
  "path/to/file": [edit operations],
  "path/to/newfile": [insertion operation],
  ...
}

Response JSON: