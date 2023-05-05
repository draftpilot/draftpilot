const importsMap = new Map<string, string>()
// note with /g this regex is stateful
const importRegex = /^import\s.+?\sfrom\s.+?;|^(const|let|var)\s.+?\s?=\s?require\(.+?\);?/gm

export function clearImportsMap() {
  importsMap.clear()
}

export function extractImports(contents: string) {
  const regex = new RegExp(importRegex)
  let match
  while ((match = regex.exec(contents)) !== null) {
    const extracted = extractSourceAndLine(match)
    if (!extracted) continue
    const { importLine, importSource, importVars } = extracted
    // ignore relative imports
    if (importSource.startsWith('.')) continue
    importsMap.set(importVars, importLine)
  }
  return importsMap
}

function extractSourceAndLine(match: RegExpExecArray) {
  const importLine = match[0]

  if (importLine.includes('import')) {
    const split = importLine.split(' from ')
    if (split.length !== 2) return null
    const importVars = split[0]
    const importSource = split[1].trim().slice(1, -1)
    return { importLine, importVars, importSource }
  } else if (importLine.includes('require(')) {
    const split = importLine.split('require(')
    if (split.length !== 2) return null
    const importVars = split[0]
    const importSource = split[1].trim().slice(1, -3)
    return { importLine, importVars, importSource }
  }
  return null
}

export function importFixer(importString: string): string {
  const regex = new RegExp(importRegex)
  const match = regex.exec(importString)

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
