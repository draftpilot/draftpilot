import { GLOB_EXCLUSIONS, Indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import open from 'open'
import { findRoot, getConfigPath, readConfig } from '@/utils/utils'
import { cache } from '@/db/cache'
import path from 'path'
import {
  filesToDirectoryTreeStruct,
  findLargestFolders,
  getManifestName,
  updateFileManifest,
} from '@/context/manifest'
import inquirer from 'inquirer'
import config from '@/config'
import { updateGitIgnores } from '@/utils/git'
import chalk from 'chalk'

type Options = {
  glob?: string
}

const GIT_IGNORE_FILES = ['cache.json', 'history.json', 'docs.sqlite']

export default async function (options?: Options) {
  const indexer = new Indexer()

  await doInitialize(indexer, options)
}

export async function doInitialize(indexer: Indexer, options?: Options) {
  const files = await indexer.getFiles(options?.glob)
  files.sort((a, b) => a.localeCompare(b))

  const dirTree = filesToDirectoryTreeStruct(files)
  const largestFolders = findLargestFolders(dirTree, 15)

  const fileLoadPromise = indexer.load(files)

  log(
    'Just like any new member of your team, I’ll need some onboarding. Here are the largest ' +
      'folders in your repository. It would be great if you wrote a short description of anything ' +
      'I should know. Feel free to add other folders, and also, put a ! in front of folders I should not ' +
      'read (e.g. tests, build scripts, etc). '
  )

  log(largestFolders)

  const root = findRoot()
  updateFileManifest('', largestFolders, root)
  const fileName = getManifestName(root)

  await open(fileName)

  const { updatedDocs } = await fileLoadPromise
  indexer.index(updatedDocs)

  log(chalk.bold('Save the file and close it when done.'))

  const existingConfig = readConfig(root) || {}

  log("Let's go through some questions.")

  const testDir = existingConfig.testDir || checkDir('test') || checkDir('tests')
  const responses = await inquirer.prompt([
    {
      type: 'input',
      name: 'testDir',
      message: 'Where do you want generated tests to go? (e.g. test/ or alongside source files)',
      default: testDir,
    },
    {
      type: 'input',
      name: 'excludes',
      message:
        'What folders should I ignore? (built-in: ' +
        GLOB_EXCLUSIONS.map((e) => e.slice(1)).join(', ') +
        ')',
    },
  ])

  existingConfig.testDir = responses.testDir
  existingConfig.excludeDir = responses.excludeDir

  const packageManager =
    existingConfig.packageManager || fs.existsSync('yarn.lock')
      ? 'yarn'
      : fs.existsSync('pnpm-lock.yaml')
      ? 'pnpm'
      : fs.existsSync('package-lock.json')
      ? 'npm'
      : 'none'

  existingConfig.packageManager = packageManager

  const configPath = getConfigPath(root)
  fs.writeFileSync(configPath.file, JSON.stringify(existingConfig, null, 2))

  cache.close()

  const gitIgnore = GIT_IGNORE_FILES.map((f) => path.join(config.configFolder, f))
  updateGitIgnores(gitIgnore)

  log('All done!')
}

import fs from 'fs'

function checkDir(dir: string) {
  if (fs.existsSync(dir)) {
    return dir
  }
  return null
}
