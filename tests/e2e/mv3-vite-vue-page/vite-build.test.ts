import { getPage } from '../helpers'
import { build } from '../runners'

test('crx runs from build output', async () => {
  const { browser } = await build(__dirname)
  const page = await getPage(browser, 'chrome-extension')

  await page.waitForSelector('#app img')

  expect(await page.screenshot()).toMatchImageSnapshot()
})
