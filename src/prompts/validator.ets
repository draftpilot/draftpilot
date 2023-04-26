---
interface Props {
  request: string
  edits: string
  exampleJson: string
}
---
Given the following request: <%= props.request %>

And the following format for operations:
<%= props.exampleJson %>

You are validating that the generated edits look correct.
<%= props.edits %>

Return "OK" if everything was accomplished and this code can be committed to the repository.
Otherwise, tell me what additional work needs to be done, and offer suggestions on how to do it.