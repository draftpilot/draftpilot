import esbuild from 'esbuild'
import tsPaths from 'esbuild-ts-paths'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import FastGlob from 'fast-glob'

const mainConfig = {
  entryPoints: ['src/main.ts', 'src/server.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node14',
  plugins: [tsPaths(), nodeExternalsPlugin()],
  format: 'esm',
  sourcemap: true,
}

const testEntries = await FastGlob('test/**/*.ts')

const testConfig = {
  entryPoints: testEntries,
  bundle: true,
  outdir: 'dist/test',
  platform: 'node',
  target: 'node14',
  plugins: [tsPaths(), nodeExternalsPlugin()],
  format: 'esm',
  sourcemap: true,
}

async function build(config) {
  if (process.argv.includes('--watch')) {
    const context = await esbuild.context(config)
    await context.watch()
  } else {
    await esbuild.build(config)
  }
}

build(mainConfig)
build(testConfig)
