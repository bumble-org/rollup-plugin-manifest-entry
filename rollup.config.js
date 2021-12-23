/* eslint-env node */

// import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import alias from '@rollup/plugin-alias'
import fs from 'fs-extra'
import path from 'path'
import bundleImports from 'rollup-plugin-bundle-imports'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const { dependencies, peerDependencies = {} } = fs.readJsonSync(
  path.join(process.cwd(), 'package.json'),
)

const external = Object.keys({
  ...dependencies,
  ...peerDependencies,
})
  .concat(
    'v8',
    'fs',
    'path',
    'xstate/lib/actions',
    'xstate/lib/model',
  )
  // ESM libraries are not supported by Rollup in config files,
  // so include them in the build to make it easier to use.
  .filter((lib) => !['read-pkg-up'].includes(lib))

const plugins = [
  alias({
    entries: [
      {
        find: /^\$src\/(.*)/,
        replacement: path.resolve(__dirname, 'src/$1'),
      },
      {
        find: '$src',
        replacement: path.resolve(__dirname, 'src', 'index.ts'),
      },
    ],
  }),
  resolve(),
  commonjs(),
  json(),
  esbuild(),
  bundleImports({
    useVirtualModule: true,
    options: {
      external: ['%PATH%'],
    },
  }),
]

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'lib/index-esm.js',
        format: 'esm',
      },
      {
        file: 'lib/index-cjs.js',
        format: 'cjs',
      },
    ],
    external,
    plugins,
  },
]
