const importsMap = new Map<string, string>()
const importRegex = /^import\s.+?\sfrom\s.+?;|^const\s.+?\s=\srequire\(.+?\);/gm

export function clearImportsMap() {
  importsMap.clear()
}

export function extractImports(contents: string) {
  let match
  while ((match = importRegex.exec(contents)) !== null) {
    const extracted = extractSourceAndLine(match)
    if (!extracted) continue
    const { importLine, importSource, importVars } = extracted
    // ignore relative imports
    if (importSource.startsWith('.')) continue
    importsMap.set(importVars, importLine)
  }
}

function extractSourceAndLine(match: RegExpExecArray) {
  const importLine = match[0]

  if (importLine.includes('import')) {
    const split = importLine.split(' from ')
    if (split.length !== 2) return null
    const importVars = split[0]
    const importSource = split[1].trim().slice(1, -1)
    return { importLine, importVars, importSource }
  } else if (importLine.includes('require')) {
    const split = importLine.split('= require(')
    if (split.length !== 2) return null
    const importVars = split[0]
    const importSource = split[1].trim().slice(1, -3)
    return { importLine, importVars, importSource }
  }
  return null
}

export function importFixer(importString: string): string {
  const match = importRegex.exec(importString)

  if (match) {
    const extracted = extractSourceAndLine(match)
    if (!extracted) return importString
    const { importVars } = extracted
    const matchingImport = importsMap.get(importVars)
    if (matchingImport) {
      return matchingImport
    }
  }

  return importString
}
