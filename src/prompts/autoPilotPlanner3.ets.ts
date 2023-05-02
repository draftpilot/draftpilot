/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./autoPilotPlanner3.ets
 */
/* eslint-disable */

interface Props {
  message: string;
  plan: string[];
  toolResults: string[];
}

export default function (props: Props): string {
  let result = "";
  result += "User's request: ";
  result += props.message;
  result += "\n\nYour previous plan of action:\n";
  result += props.plan.join("\n");
  result += "\n\nHere are the results of the tools you invoked:\n";
  result += props.toolResults.join("\n\n");
  result +=
    '\n\n------------\nThink step by step to come up with a plan of action.\n\nOutput Format schema - list of files to edit:\n{\n  "plan": [ "array of steps of changes to make" ],\n  "edits": {\n    "path/to/file": "detailed summary of changes the AI should make"\n  }\n}\n\nOR if you are not able to fulfill the request, return:\n{\n  "failure": "reason why you cannot fulfill the request"\n}\n\nAlways follow this JSON format. Your output:';
  return result;
}
