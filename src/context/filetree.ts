import config from '@/config'
import { findGitRoot } from '@/utils'
import path from 'path'
import fs from 'fs'

const INFO_FILE = 'fileinfo.txt'

type FileInfo = {
  exclude?: boolean
  description?: string
  key?: boolean
}
type FileInfoMap = { [file: string]: FileInfo }

export const readFileInfos = (root: string = findGitRoot()) => {
  const file = getInfoFileName(root)
  if (!fs.existsSync(file)) {
    return null
  }
  const contents = fs.readFileSync(file, 'utf-8').split('\n')
  const fileInfo: FileInfoMap = {}
  contents.forEach((line) => {
    let [path, description] = line.split(':', 2)
    const info: FileInfo = {}
    if (path.startsWith('!')) {
      info.exclude = true
      path = path.substring(1)
    }
    if (path.startsWith('*')) {
      info.key = true
      path = path.substring(1)
    }
    fileInfo[path] = info
    if (description) info.description = description.trim()
  })
  return fileInfo
}

export const writeFileInfos = (contents: string, root: string = findGitRoot()) => {
  const file = getInfoFileName(root)
  return fs.writeFileSync(file, contents, 'utf-8')
}

export const getInfoFileName = (root: string = findGitRoot()) => {
  return path.join(root, config.configFolder, INFO_FILE)
}

export const joinFilesWithContext = (files: string[]) => {
  const fileInfos = readFileInfos()
  if (!fileInfos) return files

  const joinedFiles: string[] = []
  files.forEach((file) => {
    const folderInfo = fileInfos[path.dirname(file)]
    if (folderInfo) {
      if (folderInfo.exclude) return
    }

    const info = fileInfos[file]
    if (info) {
      if (info.exclude) return
      if (info.description) return joinedFiles.push(file + ': ' + info.description)
    }

    joinedFiles.push(file)
  })

  return joinedFiles
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

function getDirectoryPaths(fileTree: DirectoryNode, prefix: string): string[] {
  const paths: string[] = []
  for (const path in fileTree) {
    if (fileTree[path] === true) {
      paths.push(`- ${path}`)
    } else {
      const nextPrefix = prefix ? `${prefix}/${path}` : path
      const subPaths = getDirectoryPaths(fileTree[path] as DirectoryNode, nextPrefix)
      paths.push(nextPrefix, ...subPaths)
    }
  }
  return paths
}

export function filesToDirectoryTree(files: string[]) {
  const fileTree: DirectoryNode = {}
  for (const file of files) {
    addFileToDirectory(file, fileTree)
  }

  const paths = getDirectoryPaths(fileTree, '')
  return paths
}
