---
interface Props {
  message: string
  references: string[]
  tools: string[]
}
---
<%= props.references.join('\n\n') %>
=======
User's request: <%= props.message %>

======

Think step by step to come up with a thoughtful response. 
- if you need to clarify the request, feel free to ask for it
- if certain API information is missing / outdated, you may want to search the internet
- if there are common follow-up questions, you may want to answer them

Output Format:

THOUGHT: your current thought on the request
TOOLS: [ { "name": "name of tool", "input": ["args"] } ]

Or if you need help:

THOUGHT: I need clarification
<question to ask the user goes here>

Or if you can answer the request:

THOUGHT: I can answer this
<answer goes here>

Always return JSON for the tools section, and Markdown for text for the user.

Your output: