---
interface Props {
  message: string
  references: string | undefined
}
---
<%= props.references ? 'Potentially relevant context:\n' + props.references : '' %>

======
User's request: <%= props.message %>. Think step by step to come up with a plan of action. You can take one of the following actions:

ALWAYS return in this output format:

- If you need to research information, start with "RESEARCH: <3-6 word summary of the request>"
  then the proposed steps in markdown
  a '---' separator
  the question(s) you want to ask.

- If you know what to do, start with "PLAN: <3-6 word summary of the request>"
  then the steps in markdown
  a '---' separator
  the list of files to modify (with full paths) and how they should be changed in this format:
  - path/to/file.tsx - add a row of buttons under the main <div>
  - other/path/style.css - add a new class called .my-class
  (do not output actual code but include any context needed for an agent to make the change like 
   paths to other files, actual urls, etc. do not make reference to previous chat messages):
  a '---' separator
  confidence: how confident you are this is 100% correct, no need for confirmation - low, medium, or high
