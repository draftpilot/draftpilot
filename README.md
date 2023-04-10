# Draftpilot

Draftpilot writes code in your codebase based on your instructions.

## Goal & Philosophy

Draftpilot does not aim to write code in one shot without intervention in every case (though it would be
nice to do so in simple cases). It aims to partner with the user to translate intent into
code changes in a reliable way, and learn when it gets things wrong.

When Draftpilot is working well, users should be able to start most of the changes using natural
language, continuing in the IDE for the difficult bits, like a
junior engineer pair programming with a senior engineer. Draftpilot should also be able to use
unix tools, git, and the web where appropriate.

## How to use

Draftpilot currently works best with Javascript & Typescript projects.

You can run draftpilot without installing in your codebase with npx (node.js 18+ is required):

`npx draftpilot`

Without any commands, it will run in interactive mode, but you can see all commands with `--help`.

After initialization, the following files will be generated in the `.draftpilot` folder:

- fileinfo.txt - codebase manifest. This should be checked in to git
- learning.json - a learned log of interactions. This can be checked into git to share learnings across all contributors, or ignored to be kept personal
- docs.sqlite - an index of all functions in the codebase. This
  can be ignored by git, as it is derived from the code
- history.json - a history of invocations. This can be ignored
  by git

## How it works

### Initialization

The first step is onboarding the assistant with context about the codebase, which includes the
purpose of key folders and files. This is done with the AI in partnership with the user.

### Planning

In the planning phase, the assistant tries to determine how to best fulfill the request. If needed,
it can read individual files, search the codebase, or search the web for context. The plan is
presented to the user for approval or modification.

### Execution

In the execution phase, the plan is put into action - files are created, edited, and deleted. After
execution, the user can inspect the results and ask for modifications or a redo.

## Contributing

Code contributions, issue reports, and test cases are always welcome.

In cases where the agent could be more intelligent, it is massively helpful to provide me
enough context to reproduce and debug the issue.

## License

Draftpilot is available under the [LGPL 3.0](https://spdx.org/licenses/LGPL-3.0-or-later.html) license.
You can use generated code freely commercially (subject to any copyright concerns that exist
generally with AI-generated code), but if you distribute any derived works
based on this project, you must make modifications available to the public.
