/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./genContext.ets
 */
/* eslint-disable */

interface Props {
  manifest: string;
  folders: string;
  referenceCode: string;
}

export default function (props: Props): string {
  let result = "";
  result +=
    "Please generate 1 paragraph describing the essential libraries and code patterns in use in this project, so an AI can generate code and tests that fit in seamlessly. Do not evaluate whether anything is good or bad, but focus on describing the interesting and unusual aspects of the project to an AI language model.\n\nFor reference, here is the project's manifest:\n";
  result += props.manifest;
  result += "\n\n\nKey files and folders include:\n";
  result += props.folders;
  result += "\n\n\nInteresting code snippets:\n";
  result += props.referenceCode;
  result +=
    "\n\n\n---------\n\nHere is an example of a project description:\nThe frontend uses React, Tailwind CSS, and is located in src/react. The backend uses Node.js and Express, with its code found in src/server. The database is SQLite3 and defined in src/db, while business logic resides in src/directors. The frontend store logic utilizes the nanostores library, which exposes an `atom<type>` helper with .set and .get methods. In UI components, `useStore(atomVariable)` is used to access the variable.\n\nHere is another example:\nThis project is a full-stack Next.js application using Prisma as the database and Inngest as the background job service. The frontend employs styled-components, react-router, and Redux. Jest is used for testing, and test files are located in the tests/ folder.\n\nPlease describe the essential libraries and code patterns in this project, based on the provided package.json contents and key files/folders:\n----------";
  return result;
}
