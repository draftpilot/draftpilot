import config from '@/config'
import { findGitRoot } from '@/utils'
import path from 'path'
import fs from 'fs'

const FOLDER_FILE = 'folders.txt'

type FolderInfo = { [folder: string]: string }

export const readFolderFile = (root: string = findGitRoot()) => {
  const file = getFolderFileName(root)
  if (!fs.existsSync(file)) {
    return null
  }
  const contents = fs.readFileSync(file, 'utf-8').split('\n')
  const folderInfo: FolderInfo = {}
  contents.forEach((line) => {
    const [folder, info] = line.split(':', 2)
    folderInfo[folder] = info
  })
  return folderInfo
}

export const writeFolderFile = (contents: string, root: string = findGitRoot()) => {
  const file = getFolderFileName(root)
  return fs.writeFileSync(file, contents, 'utf-8')
}

export const getFolderFileName = (root: string = findGitRoot()) => {
  return path.join(root, config.configFolder, FOLDER_FILE)
}

export const joinFoldersWithFiles = (files: string[]) => {
  const folderInfo = readFolderFile()
  if (!folderInfo) return files

  const joinedFiles: string[] = []
  files.forEach((file) => {
    let folder = path.dirname(file)
    if (!folder.startsWith('/')) folder = '/' + folder
    if (folderInfo[folder]) {
      joinedFiles.push(folder + ': ' + folderInfo[folder])
      delete folderInfo[folder]
    }
    joinedFiles.push(file)
  })

  return joinedFiles
}
