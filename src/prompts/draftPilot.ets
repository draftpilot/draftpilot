---
interface Props {
  message: string
  references: string | undefined
  exampleJson: string
}
---
<%= props.references %>
=======
User's request: <%= props.message %>

Think step by step to come up with a plan of action. You can output one of the following:

1. Research
Description: Request more information from the user.
When to use: API is unknown (implement a NextJS 13 router), or too vague (implement a backend)
Output Format: 
   RESEARCH: <short summary of request>
   All the questions you need for the user to provide to get to a clear plan

2. User Action
Description: Propose a way for the user to implement the request themselves.
When to use: big refactors (e.g. replace x with y everywhere), moves (rename folder x to y), 5+ files to edit
Output Format: 
  SUGGESTION: <short summary of request>
  How the user could implement the request themselves, e.g. with unix tools or their IDE
  

3. Direct Code
Description: Provide small changes that can be output immediately.
When to use: small changes (e.g. change the color or text of a button)
Output Format:
  CODE: <3-6 word summary of the request>
  JSON object with files as keys and arrays of operations as values:
  {
    "path/to/file": [edit operations],
    "path/to/newfile": "new file as a string",
    ...
  }
This example shows all possible operations and their inputs: <%= props.exampleJson %>

4. Action Plan
Description: Provide a plan of action for the user's request that will be executed by AI
When to use: when you know what to do
Output Format:
  PLAN: <3-6 word summary of the request>
  the steps in markdown
  a '---' separator
  the list of files to modify (with full paths) and how they should be changed in this format:
  - path/to/file.tsx - add a row of buttons under the main <div>
  - other/path/style.css - add a new class called .my-class
  (do not output actual code but include any context needed for an agent to make the change like 
  paths to other files, actual urls, etc. do not make reference to previous chat messages):
  a '---' separator
  confidence: low or high
  - high = the user's request was clear and straightforward, there's not much room for interpretation
  - low = the user's request was vague, i had to make up a lot of implementation details

Always follow this format. Your output: