import { OutputAsset, OutputChunk, OutputOptions } from 'rollup'
import { Observable } from 'rxjs'

export type Unpacked<T> = T extends Array<infer R> ? R : never

export const not =
  <T>(fn: (x: T) => boolean) =>
  (x: T) =>
    !fn(x)

export function isChunk(
  x: OutputChunk | OutputAsset,
): x is OutputChunk {
  return x && x.type === 'chunk'
}

export function isErrorLike(x: unknown): x is Error {
  return typeof x === 'object' && x !== null && 'message' in x
}

export function isOutputOptions(x: unknown): x is OutputOptions {
  return (
    !!x &&
    typeof x === 'object' &&
    !Array.isArray(x) &&
    typeof (x as any).format === 'string' &&
    ['iife', 'es', 'esm'].includes((x as any).format)
  )
}

export function isAsset(
  x: OutputChunk | OutputAsset,
): x is OutputAsset {
  return x.type === 'asset'
}

export function isString(x: any): x is string {
  return typeof x === 'string'
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(x: any): x is Function {
  return typeof x === 'function'
}

export function isUndefined(x: unknown): x is undefined {
  return typeof x === 'undefined'
}

export function isNull(x: unknown): x is null {
  return x === null
}

export function isNumber(x: unknown): x is number {
  return typeof x === 'number'
}

export function isPresent<T>(x: null | undefined | T): x is T {
  return !isUndefined(x) && !isNull(x)
}

export const jsRegex = /\.[tj]sx?$/
export const htmlRegex = /\.html?$/
export const imageRegex =
  /\.(jpe?g|png|svg|tiff?|gif|webp|bmp|ico)$/

export const getJsFilename = (p: string) =>
  p.replace(jsRegex, '.js')

export function format(
  strings: TemplateStringsArray,
  ...placeholders: string[]
) {
  const raw = strings.reduce(
    (result, string, i) => result + placeholders[i - 1] + string,
  )
  const formatted = raw.replace(/^  +/gm, '').trim()
  return formatted
}

export function log() {
  return function logFn<T>(source: Observable<T>) {
    const output = new Observable<T>((observer) => {
      const subscription = source.subscribe({
        next: (val) => {
          console.log(val)
          observer.next(val)
        },
        error: (err) => {
          console.error(err)
          observer.error(err)
        },
        complete: () => {
          console.log('%ccomplete', 'color: green')
          observer.complete()
        },
      })
      return subscription
    })
    return output
  }
}
