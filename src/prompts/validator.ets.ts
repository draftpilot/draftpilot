/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./validator.ets
 */
/* eslint-disable */

interface Props {
  request: string;
  edits: string;
  exampleJson: string;
}

export default function (props: Props): string {
  let result = "";
  result += "Given the following request: ";
  result += props.request;
  result += "\n\nAnd the following format for operations:\n";
  result += props.exampleJson;
  result += "\n\nYou are validating that the generated edits look correct.\n";
  result += props.edits;
  result +=
    '\n\nReturn "OK" if everything was accomplished and this code can be committed to the repository.\nOtherwise, tell me what additional work needs to be done, and offer suggestions on how to do it.';
  return result;
}