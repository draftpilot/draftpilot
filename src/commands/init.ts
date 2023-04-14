import { GLOB_EXCLUSIONS, Indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import open from 'open'
import { findRoot } from '@/utils/utils'
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

  const root = findRoot()
  const fileName = getManifestName(root)
  const manifestExists = fs.existsSync(fileName)
  updateFileManifest('', largestFolders, root)

  if (manifestExists) {
    log(chalk.bold('Manifest file already exists. You can edit it here:'), fileName)
  } else if (largestFolders.length > 5) {
    log(
      'Just like any new member of your team, I’ll need some onboarding. Here are the largest ' +
        'folders in your repository. It would be great if you wrote a short description of anything ' +
        'I should know. Feel free to add other folders, and also, put a ! in front of folders I should not ' +
        'read (e.g. tests, build scripts, etc). '
    )

    await open(fileName)
    log(chalk.bold('Save the file and close it when done.'))
  }

  const { updatedDocs } = await fileLoadPromise
  indexer.index(updatedDocs)
  const existingConfig = readConfig(root) || {}

  log("Let's go through some questions.")

  const testDir = existingConfig.testDir || checkDir('test') || checkDir('tests')
  const response1 = await inquirer.prompt([
    {
      type: 'input',
      name: 'testDir',
      message: 'Where do you want generated tests to go? (e.g. test/ or alongside source files)',
      default: testDir,
    },
  ])
  existingConfig.testDir = response1.testDir

  log('Built-in excluded folders:', GLOB_EXCLUSIONS.map((e) => e.slice(1)).join(', '))

  const response2 = await inquirer.prompt([
    {
      type: 'input',
      name: 'excludeDir',
      message: 'What other folders should I ignore?',
      default: existingConfig.excludeDir || '',
    },
  ])
  existingConfig.excludeDir = response2.excludeDir

  const packageManager =
    existingConfig.packageManager || fs.existsSync('yarn.lock')
      ? 'yarn'
      : fs.existsSync('pnpm-lock.yaml')
      ? 'pnpm'
      : fs.existsSync('package-lock.json')
      ? 'npm'
      : 'none'

  existingConfig.packageManager = packageManager
  writeConfig(existingConfig, root)

  cache.close()

  try {
    const gitIgnore = GIT_IGNORE_FILES.map((f) => path.join(config.configFolder, f))
    updateGitIgnores(gitIgnore)
  } catch (e) {
    log(
      chalk.yellow('Warning: unable to update .gitignore file.'),
      'You can do this later with the init command.'
    )
  }

  log('All done!')
}

import fs from 'fs'
import { getConfigPath, readConfig, writeConfig } from '@/context/projectConfig'

function checkDir(dir: string) {
  if (fs.existsSync(dir)) {
    return dir
  }
  return null
}
