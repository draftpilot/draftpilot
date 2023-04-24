/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./draftPilot.ets
 */
/* eslint-disable */

interface Props {
  message: string;
  references: string | undefined;
}

export default function (props: Props): string {
  let result = "";
  result += props.references
    ? "Potentially relevant context:\n" + props.references
    : "";
  result += "\n\n======\nUser's request: ";
  result += props.message;
  result +=
    ". Think step by step to come up with a plan of action. You can take one of the following actions:\n\nALWAYS return in this output format:\n\n- If you need to research information, start with \"RESEARCH: <3-6 word summary of the request>\"\n  then the proposed steps in markdown\n  a '---' separator\n  the question(s) you want to ask.\n\n- If you know what to do, start with \"PLAN: <3-6 word summary of the request>\"\n  then the steps in markdown\n  a '---' separator\n  the list of files to modify (with full paths) and how they should be changed in this format:\n  - path/to/file.tsx - add a row of buttons under the main <div>\n  - other/path/style.css - add a new class called .my-class\n  (do not output actual code but include any context needed for an agent to make the change like \n   paths to other files, actual urls, etc. do not make reference to previous chat messages):\n  a '---' separator\n  confidence: how confident you are this is 100% correct, no need for confirmation - low, medium, or high";
  return result;
}