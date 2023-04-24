---
interface Props {
  message: string
  attachments?: string
}
---
<%= props.attachments %>
Given the request in the prior messages, come up with a list of files to create or modify and the changes to make to them. If you need some specific details, you can ask for it, otherwise reply in this exact JSON format:

{
  "path/to/file": "detailed list of changes to make so an AI can understand",
  "path/to/bigchange": "! if the changes are large/complex (e.g. 10+ lines of code), add ! at the beginning"
  ...
}

The JSON output should ONLY contain string values.

JSON Change Plan or question to ask the user: <%= props.message %>