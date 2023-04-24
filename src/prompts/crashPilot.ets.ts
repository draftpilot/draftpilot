/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./crashPilot.ets
 */
/* eslint-disable */

interface Props {
  message: string;
  references: string | undefined;
}

export default function (props: Props): string {
  let result = "";
  result +=
    "I will paste in a crash log or bug report written by a user or product manager.\nYour job is to figure out where the possible bug/crash is. If it can be fixed simply, propose a \nfix in your response, including the file name and new code with a few lines of context.\n\nIf it's not clear what the fix is, come up with a few possible theories, and a plan for how I can\ntest them and report back. You can help me (or the user) think of ways to reproduce the bug,\nwrite a simple test case to expose the bug, or other debugging techniques. Don't go off topic \nand tell me about creating new projects or building features unless explicitly requested.\n\n======\nRelevant code snippets:\n\n";
  result += props.references || "No references provided";
  result += "\n\n======\nMy Request: ";
  result += props.message;
  return result;
}