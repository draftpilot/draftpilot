---
interface Props {
  file: string,
  plan: string,
  changes: string,
  contents: string,
  exampleJson: string,
  outputFullFile: boolean
}
---
You are given the following plan: <%= props.plan %>

Now editing: <%= props.file %>
Changes to make: <%= props.changes %>
---

<%= props.contents %>

---

<%= props.outputFullFile ? 'Output the entire file that I will write to disk, only changing the requested lines, and no markdown like ```:' : `---

You return a sequence of operations in JSON. This example shows all possible operations & thier
inputs: ${props.exampleJson}

JSON array of operations to perform:` %>