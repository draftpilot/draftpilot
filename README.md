# Draftpilot

Draftpilot writes code in your codebase based on your instructions.

This project is the standalone open-source "brains" behind [draftpilot.com](https://draftpilot.com). You can use this freely on your projects with your OpenAI API key.

## Goal & Philosophy

Draftpilot does not aim to write complete code without intervention in every case (though it
would be nice to do so in simple cases). It aims to partner with the user to translate intent into
code changes in a reliable way, and learn when it gets things wrong.

When Draftpilot is working well, users should be able to start most of the changes using natural
language, continuing in the IDE for the difficult bits, like a junior engineer pair programming with
a senior engineer. Draftpilot should also be able to use unix tools, git, and the web where appropriate.

## How to use

You'll need to set the environment variable `OPENAI_API_KEY` to your OpenAI key. We recommend having GPT-4 API access, though you can use `--gpt4 never` to stick with 3.5.

Draftpilot is currently focused on Javascript & Typescript projects, though it will work for other types of codebases. You may want to create a custom extractor (see `pyExtractor.ts` for an example) for best results.

You can run draftpilot without installing in your codebase with npx:

`npx -y draftpilot@latest`

Or add the following alias to your `.bashrc`/`.zshrc` for convenience:

`alias dpt="npx -y draftpilot@latest"`

You can see all commands with `--help`.

After usage, configuration and temporary files will be generated in the `.draftpilot` folder. This folder can be inspected for partial output in case things go wrong, but should not be checked into git.

## Tips for use / Limitations

Due to token limits, Draftpilot works on codebases with smaller files. If you have very large files, i.e. > 1000+ lines, Draftpilot will not be able to load as much context into the prompt. In the future we may support chunking file edits for large files.

Draftpilot is not the best tool for large refactors.

While you can give a vague request and hope it gets figured out, it's best to provide as much
context as possible - which files to read & edit, and how you want the changes made.

## Development instructions

Draftpilot uses npm - run `npm i` to install dependencies, `npm run watch` to run the server and
frontend in watch mode, and `npm run test` to run tests.

All prompts are in the `src/prompts` folder in embedded-typescript format. If you make changes to
the .ets files, run `npm run ets` to regenerate the .ets.ts files, which provide type-safety

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
