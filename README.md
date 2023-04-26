# Draftpilot

Draftpilot writes code in your codebase based on your instructions.

## Goal & Philosophy

Draftpilot does not aim to write code in one shot without intervention in every case (though it
would be nice to do so in simple cases). It aims to partner with the user to translate intent into
code changes in a reliable way, and learn when it gets things wrong.

When Draftpilot is working well, users should be able to start most of the changes using natural
language, continuing in the IDE for the difficult bits, like a junior engineer pair programming with
a senior engineer. Draftpilot should also be able to use unix tools, git, and the web where appropriate.

## How to use

Draftpilot currently works best with Javascript & Typescript projects. For other projects, you
may want to create a custom extractor (see `pyExtractor.ts` for an example).
You'll need to set the environment variable `OPENAI_API_KEY` to your OpenAI key.

You can run draftpilot without installing in your codebase with npx:

`npx -y draftpilot@latest`

Or add the following alias to your `.bashrc`/`.zshrc` for convenience:

`alias dpt="npx -y draftpilot@latest"`

You can see all commands with `--help`. Most commands are used only for debugging purposes.

After initialization, the following files will be generated in the `.draftpilot` folder. This folder
is automatically added to .gitignore.

- context.txt - codebase context (if using without Draftpilot backend). You can check this into git if desired.
- docs.sqlite - an index of all functions in the codebase
- history.json - history of invocations

## Tips for use / Limitations

Due to token limits, Draftpilot works on codebases with smaller files. If you have very large files,
i.e. > 500 lines you may want to consider splitting them up if you want to work with them. In the
future we will implement the ability to edit chunks of a file.

Draftpilot is not the best tool for large refactors - it will try to tell you so too.

While you can give a vague request and hope it gets figured out, it's best to provide as much
context as possible - which files to read & edit, and how you want the changes made.

## Development instructions

Draftpilot uses yarn - run `yarn` to install dependencies, `yarn watch` to run the server and
frontend in watch mode, and `yarn test` to run tests.

All prompts are in the `src/prompts` folder in embedded-typescript format. If you make changes to
the .ets files, run `yarn ets` to regenerate the .ets.ts files, which provide type-safety

## How it works

### Context

The first step is onboarding the assistant with context about the codebase, which includes the
main libraries used and the purpose of key folders and files. This is done with the AI in partnership with the user.

### Planning

In the planning phase, the assistant tries to determine how to best fulfill the request. If needed,
it can read individual files, run a command, search the codebase, or search the web for context. The plan is
presented to the user for approval or modification.

### Execution

In the execution phase, the plan is put into action - files are created, edited, and deleted. After
execution, the user can inspect the results and ask for modifications or a redo.

### Validation

In the validation phase, the assistant tries to get the code into a reasonable shape.

### Commit

In the commit phase, the changes are summarized into a git commit. Commits by draftpilot are
prefixed so that it's clear from `git blame` that these changes were written by an AI. I recommend
separating AI commits from user changes so future AI learns from humans and not generated code.

## Contributing

Code contributions, issue reports, and test cases are always welcome.

In cases where the agent could be more intelligent, it is massively helpful to provide enough
context to reproduce and debug the issue. Draftpilot records its API requests to the /tmp folder,
so you can send those as well, stripping out any sensitive information.

## License

Draftpilot is available under the [AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.en.html) license.
You can use generated code freely commercially (subject to any copyright concerns that exist
generally with AI-generated code), but if you distribute any derived works based on this project,
you must make modifications available to the public.
