import cheerio, { CheerioAPI } from 'cheerio'
import { Observable, of } from 'rxjs'
import { AssetEvent, model } from './files-asset.machine'
import { isString } from './helpers'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from './path'
import { Asset, BaseAsset, FileType, Script } from './types'

export function htmlParser(
  root: string,
): (context: Asset) => Observable<AssetEvent> {
  return ({ id: htmlId, source, fileName }) => {
    try {
      const htmlDir = dirname(htmlId)

      const result = Object.entries(
        parseHtml(source as string),
      ) as [FileType, string[]][]

      const files = result.flatMap(([fileType, fileNames]) =>
        fileNames.map((inputFileName): Script | BaseAsset => {
          let id: string
          if (isAbsolute(inputFileName))
            id = join(root, inputFileName)
          else id = resolve(htmlDir, inputFileName)
          const fileName = relative(root, id)

          return {
            fileType,
            id,
            fileName,
          }
        }),
      )

      return of(model.events.PARSE_RESULT(fileName, files))
    } catch (error) {
      return of(model.events.ERROR(error))
    }
  }
}

/**
 * Returns filenames relative to the HTML file
 * The HTML file may be at any depth inside the root
 */
export function parseHtml(
  source: string,
): Record<
  Exclude<
    FileType,
    | 'MANIFEST'
    | 'HTML'
    | 'JSON'
    | 'SCRIPT_BACKGROUND'
    | 'SCRIPT_DECLARED'
    | 'SCRIPT_DYNAMIC'
  >,
  string[]
> {
  const $ = cheerio.load(source)
  return {
    SCRIPT_HTML: getScriptSrc($),
    CSS: getCssHrefs($),
    IMAGE: getImgSrcs($),
    RAW: getJsAssets($),
  }
}

/* -------------------- SCRIPTS -------------------- */

export function getScripts($: CheerioAPI) {
  return $('script')
    .not('[data-rollup-asset]')
    .not('[src^="http:"]')
    .not('[src^="https:"]')
    .not('[src^="data:"]')
    .not('[src^="/"]')
    .toArray()
}

export function getScriptSrc($: CheerioAPI) {
  return getScripts($)
    .map((elem) => $(elem).attr('src'))
    .filter(isString)
}

/* ----------------- ASSET SCRIPTS ----------------- */

function getAssets($: CheerioAPI) {
  return $('script')
    .filter('[data-rollup-asset="true"]')
    .not('[src^="http:"]')
    .not('[src^="https:"]')
    .not('[src^="data:"]')
    .not('[src^="/"]')
    .toArray()
}

export function getJsAssets($: CheerioAPI) {
  return getAssets($)
    .map((elem) => $(elem).attr('src'))
    .filter(isString)
}

/* ---------------------- CSS ---------------------- */

function getCss($: CheerioAPI) {
  return $('link')
    .filter('[rel="stylesheet"]')
    .not('[href^="http:"]')
    .not('[href^="https:"]')
    .not('[href^="data:"]')
    .not('[href^="/"]')
    .toArray()
}

export function getCssHrefs($: CheerioAPI) {
  return getCss($)
    .map((elem) => $(elem).attr('href'))
    .filter(isString)
}

/* --------------------- IMAGES -------------------- */

function getImgs($: CheerioAPI) {
  return $('img')
    .not('[src^="http://"]')
    .not('[src^="https://"]')
    .not('[src^="data:"]')
    .toArray()
}

function getFavicons($: CheerioAPI) {
  return $('link[rel="icon"]')
    .not('[href^="http:"]')
    .not('[href^="https:"]')
    .not('[href^="data:"]')
    .toArray()
}

export function getImgSrcs($: CheerioAPI) {
  return [
    ...getImgs($).map((elem) => $(elem).attr('src')),
    ...getFavicons($).map((elem) => $(elem).attr('href')),
  ].filter(isString)
}
