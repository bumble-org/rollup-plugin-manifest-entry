import glob from 'glob'
import get from 'lodash.get'
import diff from 'lodash.difference'
import { join } from 'path'
import { OutputChunk } from 'rollup'
import * as permissions from './permissions'
import { ContentScript } from '../../manifest-types'
import { isString } from '../../helpers'

/* ============================================ */
/*              DERIVE PERMISSIONS              */
/* ============================================ */

export const derivePermissions = (
  set: Set<string>,
  { code }: OutputChunk,
) =>
  Object.entries(permissions)
    .filter(([, fn]) => fn(code))
    .map(([key]) => key)
    .reduce((s, p) => s.add(p), set)

/* -------------------------------------------- */
/*                 DERIVE FILES                 */
/* -------------------------------------------- */

export function deriveFiles(
  manifest: chrome.runtime.Manifest,
  srcDir: string,
) {
  if (manifest.manifest_version === 3) {
    return deriveFilesMV3(manifest, srcDir)
  } else {
    return deriveFilesMV2(manifest, srcDir)
  }
}

export function deriveFilesMV3(
  manifest: chrome.runtime.ManifestV3,
  srcDir: string,
) {
  const files = get(
    manifest,
    'web_accessible_resources',
    [] as Required<typeof manifest>['web_accessible_resources'],
  )
    .flatMap(({ resources }) => resources)
    .reduce((r, x) => {
      if (glob.hasMagic(x)) {
        const files = glob.sync(x, { cwd: srcDir })
        return [...r, ...files.map((f) => f.replace(srcDir, ''))]
      } else {
        return [...r, x]
      }
    }, [] as string[])

  const js = [
    ...files.filter((f) => /\.[jt]sx?$/.test(f)),
    get(manifest, 'background.service_worker'),
    ...get(
      manifest,
      'content_scripts',
      [] as ContentScript[],
    ).reduce((r, { js = [] }) => [...r, ...js], [] as string[]),
  ]

  const html = [
    ...files.filter((f) => /\.html?$/.test(f)),
    get(manifest, 'options_page'),
    get(manifest, 'options_ui.page'),
    get(manifest, 'devtools_page'),
    get(manifest, 'action.default_popup'),
    ...Object.values(get(manifest, 'chrome_url_overrides', {})),
  ]

  const css = [
    ...files.filter((f) => f.endsWith('.css')),
    ...get(
      manifest,
      'content_scripts',
      [] as ContentScript[],
    ).reduce(
      (r, { css = [] }) => [...r, ...css],
      [] as string[],
    ),
  ]

  const img = [
    ...files.filter((f) =>
      /\.(jpe?g|png|svg|tiff?|gif|webp|bmp|ico)$/i.test(f),
    ),
    ...(Object.values(get(manifest, 'icons', {})) as string[]),
    ...(Object.values(
      get(manifest, 'action.default_icon', {}),
    ) as string[]),
  ]

  // Files like fonts, things that are not expected
  const others = diff(files, css, js, html, img)

  return {
    css: validate(css),
    js: validate(js),
    html: validate(html),
    img: validate(img),
    others: validate(others),
  }

  function validate(ary: any[]) {
    return [...new Set(ary.filter(isString))].map((x) =>
      join(srcDir, x),
    )
  }
}

export function deriveFilesMV2(
  manifest: chrome.runtime.ManifestV2,
  srcDir: string,
) {
  const files = get(
    manifest,
    'web_accessible_resources',
    [] as Required<typeof manifest>['web_accessible_resources'],
  ).reduce((r, x) => {
    if (glob.hasMagic(x)) {
      const files = glob.sync(x, { cwd: srcDir })
      return [...r, ...files.map((f) => f.replace(srcDir, ''))]
    } else {
      return [...r, x]
    }
  }, [] as string[])

  const js = [
    ...files.filter((f) => /\.[jt]sx?$/.test(f)),
    ...get(manifest, 'background.scripts', [] as string[]),
    ...get(
      manifest,
      'content_scripts',
      [] as ContentScript[],
    ).reduce((r, { js = [] }) => [...r, ...js], [] as string[]),
  ]

  const html = [
    ...files.filter((f) => /\.html?$/.test(f)),
    get(manifest, 'background.page'),
    get(manifest, 'options_page'),
    get(manifest, 'options_ui.page'),
    get(manifest, 'devtools_page'),
    get(manifest, 'browser_action.default_popup'),
    get(manifest, 'page_action.default_popup'),
    ...Object.values(get(manifest, 'chrome_url_overrides', {})),
  ]

  const css = [
    ...files.filter((f) => f.endsWith('.css')),
    ...get(
      manifest,
      'content_scripts',
      [] as ContentScript[],
    ).reduce(
      (r, { css = [] }) => [...r, ...css],
      [] as string[],
    ),
  ]

  const actionIconSet = [
    'browser_action.default_icon',
    'page_action.default_icon',
  ].reduce((set, query) => {
    const result: string | { [size: string]: string } = get(
      manifest,
      query,
      {},
    )

    if (typeof result === 'string') {
      set.add(result)
    } else {
      Object.values(result).forEach((x) => set.add(x))
    }

    return set
  }, new Set<string>())

  const img = [
    ...actionIconSet,
    ...files.filter((f) =>
      /\.(jpe?g|png|svg|tiff?|gif|webp|bmp|ico)$/i.test(f),
    ),
    ...Object.values(get(manifest, 'icons', {})),
  ]

  // Files like fonts, things that are not expected
  const others = diff(files, css, js, html, img)

  return {
    css: validate(css),
    js: validate(js),
    html: validate(html),
    img: validate(img),
    others: validate(others),
  }

  function validate(ary: any[]) {
    return [...new Set(ary.filter(isString))].map((x) =>
      join(srcDir, x),
    )
  }
}
