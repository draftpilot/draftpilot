import config from '@/config'
import { findRoot, splitOnce } from '@/utils/utils'
import path from 'path'
import fs from 'fs'
import { FileInfo, FileManifest } from '@/types'

const INFO_FILE = 'manifest.txt'

export const readManifest = (root: string = findRoot()) => {
  const file = getManifestName(root)
  if (!fs.existsSync(file)) {
    return null
  }
  const contents = fs.readFileSync(file, 'utf-8').split('\n')
  const fileInfo: FileManifest = {}
  let folder: string = ''
  contents.forEach((line) => {
    if (line.startsWith('#')) return
    let [name, description] = splitOnce(line, ':')

    const isFile = name.startsWith('- ')
    if (!isFile) folder = name
    else name = name.substring(2)

    const info: FileInfo = {}
    if (name.startsWith('!')) {
      info.exclude = true
      name = name.substring(1)
    }
    if (name.startsWith('*')) {
      info.key = true
      name = name.substring(1)
    }

    if (isFile) name = path.join(folder, name)
    fileInfo[name] = info
    if (description) info.description = description.trim()
  })
  return fileInfo
}

export const writeManifest = (contents: string, root: string = findRoot()) => {
  const file = getManifestName(root)
  return fs.writeFileSync(file, contents, 'utf-8')
}

export const getManifestName = (root: string = findRoot()) => {
  return path.join(root, config.configFolder, INFO_FILE)
}

export const getFilesWithContext = (files: string[]): string[] => {
  const file = getManifestName()
  if (!fs.existsSync(file)) {
    return files
  }
  const existingInfos = readManifest() || {}

  const dirTree = filesToDirectoryTree(files)

  let folder = ''
  const outputLines: string[] = []
  dirTree.forEach((line) => {
    const isFile = line.startsWith('- ')

    if (!isFile) folder = line
    else line = line.substring(2)

    const prefix = isFile ? '- ' : ''

    const file = isFile ? path.join(folder, line) : line
    const existing = existingInfos[file]
    if (existing?.exclude) return

    const existingFolder = existingInfos[folder]
    if (existingFolder?.exclude) return

    outputLines.push(`${prefix}${line}${existing?.description ? ': ' + existing.description : ''}`)
  })

  return outputLines
}

interface DirectoryNode {
  // true = file, DirectoryNode = directory
  [key: string]: DirectoryNode | true
}

function addFileToDirectory(directory: string, fileTree: DirectoryNode) {
  const [firstDir, ...restDirs] = directory.split('/')
  if (!fileTree[firstDir]) {
    fileTree[firstDir] = restDirs.length ? {} : true
  }
  if (restDirs.length) {
    addFileToDirectory(restDirs.join('/'), fileTree[firstDir] as DirectoryNode)
  }
}

function getDirectoryPaths(
  fileTree: DirectoryNode,
  prefix: string,
  foldersOnly?: boolean
): string[] {
  const paths: string[] = []
  const fileTreeSorter = (a: string, b: string) =>
    fileTree[a] === true && fileTree[b] === true
      ? a.localeCompare(b)
      : fileTree[a] === true
      ? -1
      : fileTree[b] === true
      ? 1
      : a.localeCompare(b)
  const keys = Object.keys(fileTree).sort(fileTreeSorter)
  for (const path of keys) {
    if (fileTree[path] === true) {
      if (!foldersOnly) paths.push(`- ${path}`)
    } else {
      const nextPrefix = prefix ? `${prefix}/${path}` : path
      const subPaths = getDirectoryPaths(fileTree[path] as DirectoryNode, nextPrefix)
      paths.push(nextPrefix, ...subPaths)
    }
  }
  return paths
}

export function filesToDirectoryTreeStruct(files: string[]) {
  const fileTree: DirectoryNode = {}
  for (const file of files) {
    addFileToDirectory(file, fileTree)
  }
  return fileTree
}

export function filesToDirectoryTree(files: string[], foldersOnly?: boolean) {
  const fileTree: DirectoryNode = filesToDirectoryTreeStruct(files)

  const paths = getDirectoryPaths(fileTree, '', foldersOnly)
  return paths
}

export function findLargestFolders(dirTree: DirectoryNode, max: number) {
  const map: FolderSizes = {}
  getFolderSizes('.', dirTree, map, max)
  return Object.keys(map)
    .sort((a, b) => map[b] - map[a])
    .slice(0, max)
    .sort((a, b) => a.localeCompare(b))
}

// recursively list folder sizes
type FolderSizes = { [key: string]: number }
function getFolderSizes(
  prefix: string,
  dirTree: DirectoryNode,
  map: FolderSizes = {},
  max?: number
) {
  const size = Object.keys(dirTree).length
  if (!max || Object.values(map).filter((v) => v > size).length < max) map[prefix] = size

  const folders = Object.keys(dirTree).filter((key) => dirTree[key] !== true)
  for (const path of folders) {
    const nextPrefix = `${prefix}/${path}`
    getFolderSizes(nextPrefix, dirTree[path] as DirectoryNode, map, max)
  }
}

export function updateFileManifest(
  guessedFiles: string,
  dirTree: string[],
  root: string = findRoot()
) {
  const existingInfos = (root && readManifest(root)) || {}

  const folderGuessMap = new Map<string, string>()
  const guessedFileLines = guessedFiles.split('\n')
  guessedFileLines.forEach((line) => {
    const [file, guess] = line.split(':')
    if (file && guess) folderGuessMap.set(file.trim(), guess.trim())
  })

  const outputLines: string[] = []
  let folder = ''
  dirTree.forEach((line) => {
    const isFile = line.startsWith('- ')
    if (!isFile) folder = line
    else line = line.substring(2)

    const file = isFile ? path.join(folder, line) : line
    const existing = existingInfos[file]
    const prefix = makePrefix(isFile, existing)
    const guess = folderGuessMap.get(file)
    if (guess) folderGuessMap.delete(file)

    outputLines.push(`${prefix}${line}: ${existing?.description || guess || ''}`)
  })

  for (const folder of folderGuessMap.keys()) {
    outputLines.push(`${folder}: ${folderGuessMap.get(folder)}`)
  }

  outputLines.unshift(
    '# manifest format: folder: description. lines beginning in ! will be excluded'
  )
  writeManifest(outputLines.join('\n'), root)
}

const makePrefix = (isFile: boolean, existing: FileInfo | undefined) =>
  (isFile ? '- ' : '') + (existing?.exclude ? '!' : existing?.key ? '*' : '')
