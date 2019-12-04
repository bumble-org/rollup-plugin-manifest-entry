import { OutputAsset, OutputChunk } from 'rollup'

export const not = <T>(fn: (x: T) => boolean) => (x: T) => !fn(x)

export function isChunk(
  x: OutputChunk | OutputAsset,
): x is OutputChunk {
  return x.type === 'chunk'
}

export function isAsset(
  x: OutputChunk | OutputAsset,
): x is OutputChunk {
  return x.type === 'asset'
}
