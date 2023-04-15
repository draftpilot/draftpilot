export default () => {
  return (
    <div className="bg-green-100 justify-self-center p-4 shadow rounded">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Welcome to draftpilot!</h1>

      <p>Here are some things you can ask me to do:</p>

      <ul className="list-disc list-inside mt-2 flex flex-col gap-2">
        <li>
          Write tests for <code>transformer.ts</code>
        </li>
        <li>Find a package for a fuzzy string matcher</li>
        <li>
          For all instances of <code>FOO</code>, add <code>BAR</code> next to it
        </li>
        <li>
          Look for bugs in <code>importantFile.ts</code>
        </li>
        <li>Create a React hook for auto-expanding textarea and save it to src/components</li>
      </ul>
    </div>
  )
}
