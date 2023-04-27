---
interface Props {
  request: string
  references: string
}
---
<%= props.references %>

Based on my query + previous history, answer the question:
<%= props.request %>

