---
interface Props {
  files: string
  exampleJson: string
}
---
Given the request in the prior messages, make the requested changes to the files using the JSON operation format described. If there are no edits to make, don't include that file. New files will be created.

Here is a list of files.
<%= props.files %>

---
This example shows all possible operations & thier inputs. ALWAYS follow this exact 
format of operation names and input args. <%= props.exampleJson %>

Your return format is a JSON object with files as keys and arrays of operations as values. If the edit operations are long or require many changes, you can return the entire file as a string instead of array of operations.  
{
  "path/to/file": [edit operations],
  "path/to/newfile": "new file as a string",
  ...
}

Response JSON: