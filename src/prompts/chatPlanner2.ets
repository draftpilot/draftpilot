---
interface Props {
  message: string
  thought: string
  toolResults: string[]
}
---
User's request: <%= props.message %>

Your previous thought:
<%= props.thought %>

Here are the results of the tools you invoked:
<%= props.toolResults.join('\n\n') %>

------------

Your response to the user, in Markdown: