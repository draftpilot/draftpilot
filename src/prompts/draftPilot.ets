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

Think step by step to come up with a plan of action. You can take one of the following actions:

ALWAYS return in this format:

- If you need key information, output "RESEARCH: <3-6 word summary of the request>"
  then the proposed steps in markdown
  a '---' separator
  the question(s) you need the user to provide, e.g. a spec, APIs you don't know about, or more context

  examples: implement a NextJS 13 router, implement a backend for me

- If request involves moving folders or editing more than 5 files, output "SUGGESTION: <3-6 word summary of the request>"
  then the proposed steps in markdown
  a '---' separator
  a suggested way the user could implement the request themselves, e.g. with unix tools or their IDE.

  examples: replace 'bob' with 'joe' everywhere

- If request involves small changes that you know exactly how to do, output "EDITS: <3-6 word summary of the request>"
  Then, a JSON object with files as keys and arrays of operations as values:
  {
    "path/to/file": [edit operations],
    "path/to/newfile": "new file as a string",
    ...
  }
  This example shows all possible operations & thier inputs: <%= props.exampleJson %>

- Otherwise, start with "PLAN: <3-6 word summary of the request>"
  then the steps in markdown
  a '---' separator
  the list of files to modify (with full paths) and how they should be changed in this format:
  - path/to/file.tsx - add a row of buttons under the main <div>
  - other/path/style.css - add a new class called .my-class
  (do not output actual code but include any context needed for an agent to make the change like 
   paths to other files, actual urls, etc. do not make reference to previous chat messages):
  a '---' separator
  confidence: low or high
    high = the user's request was clear and straightforward, there's not much room for interpretation
    low = the user's request was vague, i had to make up a lot of implementation details
