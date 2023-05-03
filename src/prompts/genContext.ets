---
interface Props {
  manifest: string
  folders: string
  referenceCode: string
}
---
Please generate 1 paragraph describing the essential libraries and code patterns in use in this project, so an AI can generate code and tests that fit in seamlessly. Do not evaluate whether anything is good or bad, but focus on describing the interesting and unusual aspects of the project to an AI language model.

For reference, here is the project's manifest:
<%= props.manifest %>


Key files and folders include:
<%= props.folders %>


Interesting code snippets:
<%= props.referenceCode %>


---------

Here is an example of a project description:
The frontend uses React, Tailwind CSS, and is located in src/react. The backend uses Node.js and Express, with its code found in src/server. The database is SQLite3 and defined in src/db, while business logic resides in src/directors. The frontend store logic utilizes the nanostores library, which exposes an `atom<type>` helper with .set and .get methods. In UI components, `useStore(atomVariable)` is used to access the variable.

Here is another example:
This project is a full-stack Next.js application using Prisma as the database and Inngest as the background job service. The frontend employs styled-components, react-router, and Redux. Jest is used for testing, and test files are located in the tests/ folder.

Please describe the essential libraries and code patterns in this project, based on the provided package.json contents and key files/folders:
----------