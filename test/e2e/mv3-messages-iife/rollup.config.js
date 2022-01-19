import { chromeExtension } from '$src'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'
import path from 'path'

export const outDir = path.join(__dirname, 'dist-rollup-build')

export default {
  input: 'src/manifest.json',
  output: {
    dir: outDir,
    format: 'esm',
    chunkFileNames: 'chunks/[name]-[hash].js',
  },
  plugins: [
    chromeExtension({
      contentScriptFormat: 'iife',
    }),
    esbuild(),
    resolve(),
    commonjs(),
  ],
}
