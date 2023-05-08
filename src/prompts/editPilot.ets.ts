/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./editPilot.ets
 */
/* eslint-disable */

interface Props {
  references: string;
  files: string;
  exampleJson: string;
}

export default function (props: Props): string {
  let result = "";
  result +=
    "Given the request in the prior messages, make the requested changes to the files using the JSON operation format described. If there are no edits to make, don't include that file. New files will be created.\n\nHere is a list of files to edit.\n\n";
  result += props.files;
  result += "\n\nRelated snippets within the codebase that may be helpful:\n\n";
  result += props.references;
  result +=
    '\n\n---\nThis example shows all possible operations & thier inputs. ONLY use these operation types and arguments, follow it exactly. The line number and startLine should refer to the same line.\n\n{\n  "file/name": ';
  result += props.exampleJson;
  result +=
    '\n}\n\nYour return format is a JSON object with files as keys and arrays of operations as values. If the edit operations are long or require many changes, you can return the entire file as a string instead of array of operations.  \n{\n  "path/to/file": [edit operations],\n  "path/to/newfile": "new file as a string",\n  ...\n}\n\nResponse JSON:';
  return result;
}
