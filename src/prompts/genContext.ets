---
interface Props {
  manifest: string
  folders: string
  referenceCode: string
}
---
selected code snippets:
<%= props.referenceCode %>

---
<%= props.manifest %>

---
key folders:
<%= props.folders %>

---
Please generate ~3 paragraphs describing the key libraries and code patterns in use in this project so an AI can generate code that fits in. Do not evaulate whether anything is good or bad, just describe the interesting facts to an AI language model.

Here is an example:
This is a react & express project. The frontend uses tailwindcss and lives in src/react. The backend uses nodejs and express and lives in src/server. Database is sqlite3 and defined in src/db. Business logic lives in src/directors.

The frontend store logic is using a library called nanostores, which exposes an `atom<type>` helper with .set and .get methods. In the ui components. `useStore(atomVariable)` is used to get access to the variable.

---
Project context: