import DB from '@/db/db'
import { log } from '@/logger'
import { findGitRoot } from '@/utils'
import fastGlob from 'fast-glob'

type Options = {
  force?: boolean
}

const DEFAULT_GLOB = [
  '**/*.js',
  '**/*.ts',
  '**/*.jsx',
  '**/*.tsx',
  '!node_modules/**',
  '!dist/**',
  '!build/**',
]

export default async function (options: Options) {
  const root = findGitRoot()
  const db = new DB(root)
  log(db.existing ? 're-indexing your project' : 'generating index for the first time...')

  const [_, files] = await Promise.all([db.init(), fastGlob(DEFAULT_GLOB)])

  await db.processFiles(files)
}
