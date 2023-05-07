import esbuild from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import FastGlob from 'fast-glob'
import { commonjs } from '@hyrious/esbuild-plugin-commonjs'

async function main() {
  const mainConfig = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    target: 'node14',
    plugins: [nodeExternalsPlugin(), commonjs()],
    sourcemap: true,
    format: 'esm',
  }

  const testEntries = await FastGlob('test/**/*.ts')

  const testConfig = {
    entryPoints: testEntries,
    bundle: true,
    outdir: 'dist/test',
    platform: 'node',
    target: 'node14',
    plugins: [nodeExternalsPlugin(), commonjs()],
    sourcemap: true,
    format: 'esm',
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
}

main()
