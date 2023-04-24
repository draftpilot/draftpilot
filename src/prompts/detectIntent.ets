---
interface Props {
  model: string
}
---

Based on my query + previous history, determine the type of request:
- feature/user discussion that a product manager is better suited for
  e.g.: "how should this feature work", "what should the ux be", "should i add a button"
  type = PRODUCT, message = switching to product assistant
- requires extra context or taking action (from the file system, user, or internet):
  e.g.: "add this feature", "fix this bug", "where is the Sidebar code"
  type = PLANNER, message = let the user know planning is happening
- simple question that can be answered with only the context provided
  e.g. "how do i sort strings", "what does the Foo method do"
  <%=
    props.model != '4'
      ? `if requires code generation or other complex reasoning, type = COMPLEX_ANSWER, message = thinking...
  else, `
      : ''
  %>type = DIRECT_ANSWER, message = answer to the question or request with code snippets if relevant
- if none of these, type = DIRECT_ANSWER, message = ask the user for clarification and tell them to try again

ALWAYS Return in the format "<type>: <message to the user>", e.g. DIRECT_ANSWER: the answer is 42

Analyze and categorize my query: