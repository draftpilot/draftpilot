/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 *
 * Run `npx ets` or `yarn ets` to regenerate this file.
 * Source: ./jsonFixer.ets
 */
/* eslint-disable */

interface Props {
  input: string;
  schema: string;
}

export default function (props: Props): string {
  let result = "";
  result += "I want the following input to conform to a schema:\n";
  result += props.input;
  result += "\n\nSchema:\n";
  result += props.schema;
  result += "\n\nFormatted input:\n";
  return result;
}