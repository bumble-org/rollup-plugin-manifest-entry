import fs from 'fs-extra'
import path from 'path'
import { Locator } from 'playwright-chromium'
import { getPage } from '../helpers'
import { serve } from '../runners'

/** WaitForFunction uses eval, which doesn't work for CRX */
async function waitForInnerHtml(
  locator: Locator,
  pred: (html: string) => boolean = () => true,
) {
  let count = 0
  while (count < 300) {
    const n = await locator.count()
    for (let i = 0; i < n; ++i) {
      const item = locator.nth(i)
      const html = await item.innerHTML()
      if (pred(html)) return item
    }

    count++
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('could not find element')
}

test('crx page update on hmr', async () => {
  const src = path.join(__dirname, 'src')
  const src1 = path.join(__dirname, 'src1')
  const src2 = path.join(__dirname, 'src2')
  const src3 = path.join(__dirname, 'src3')

  await fs.remove(src)
  await fs.copy(src1, src, { recursive: true })

  const { browser } = await serve(__dirname)
  const page = await getPage(browser, 'chrome-extension')

  await page.waitForLoadState()

  const styles = page.locator('head style')
  const button = page.locator('button')

  const buttonText = new Set<string>()

  await button.click()
  buttonText.add(await button.innerText())

  // check that page does not update during hmr update
  let reloaded = false
  page.on('framenavigated', () => {
    reloaded = true
  })

  // update template
  await fs.copy(src2, src, {
    recursive: true,
    overwrite: true,
    filter: (f) => {
      if (fs.lstatSync(f).isDirectory()) return true
      return f.endsWith('vue')
    },
  })

  await page.locator('h1', { hasText: 'Hello Vue 3 + Vite + CRX' }).waitFor()
  expect(reloaded).toBe(false) // no reload on template update
  buttonText.add(await button.innerText())

  // vite doesn't hot update if the change is too quick
  await new Promise((r) => setTimeout(r, 100))

  // update css
  await fs.copy(src3, src, {
    recursive: true,
    overwrite: true,
    filter: (f) => {
      if (fs.lstatSync(f).isDirectory()) return true
      return f.endsWith('vue')
    },
  })

  await waitForInnerHtml(styles, (h) => h.includes('background: red;'))
  expect(reloaded).toBe(false) // no reload on css update
  buttonText.add(await button.innerText())

  expect(buttonText.size).toBe(1)
  expect(buttonText.has('count is: 1')).toBe(true)
})
