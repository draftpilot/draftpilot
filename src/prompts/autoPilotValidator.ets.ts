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
    '\n-------\nPoint out any problems with the generated code where it doesn\'t do what the user requested or has errors, and suggest any changes to make. Output in the following format:\n\nIf there are no problems:\n{\n  "result": "good",\n  "comments: "Any notes to pass to the user in a PR comment, e.g. what else needs to be done"\n}\n\nIf there are changes to make to fix issues or better match the user\'s request, use this format.\nThe keys are each file that you want to change (on top of the existing diff above), the value\nis the change to make to that file. Every file to change must be in the list.\n{\n  "result": "rewrite",\n  "path/to/file": "detailed summary of changes the AI should make",\n  ... more files ...\n}\n\nYour JSON output:';
  return result;
}
