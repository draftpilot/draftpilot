/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./autoPilotValidator.ets
 */
/* eslint-disable */

interface Props {
  request: string;
  diff: string;
  compilerOutput: string | null;
}

export default function (props: Props): string {
  let result = "";
  result += "User's request: ";
  result += props.request;
  result += "\n\nThe AI generated this diff in response:\n";
  result += props.diff;
  result += "\n\n";
  result += props.compilerOutput
    ? "This was the compiler output:\n" +
      (props.compilerOutput || "no output (probably successful)")
    : "";
  result +=
    '\n-------\nPoint out any problems with the generated code where it doesn\'t do what the user requested or has errors, and suggest any changes to make. Output in the following format:\n\nIf there are no problems:\n{\n  "result": "good",\n  "comments: "Any notes to pass to the user in the pull request description, e.g. what else needs to be done"\n}\n\nIf there are changes to make to fix issues or better match the user\'s request:\n{\n  "result": "rewrite",\n  "path/to/file": "description of how this file should be changed, so an AI can modify it",\n  ... more files ...\n}\n\nYour JSON output:';
  return result;
}
