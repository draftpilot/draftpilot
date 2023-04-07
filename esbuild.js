import esbuild from 'esbuild'
import tsPaths from 'esbuild-ts-paths'
import { nodeExternalsPlugin } from 'esbuild-node-externals'

const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node14',
  plugins: [tsPaths(), nodeExternalsPlugin()],
  format: 'esm',
}

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(config)
  await context.watch()
} else {
  await esbuild.build(config)
}
