import { getPage } from '../helpers'
import { serve } from '../runners'

jest.retryTimes(2)

test('crx runs from server output', async () => {
  const { browser } = await serve(__dirname)
  const options = await getPage(browser, 'chrome-extension')
  const handle = await options.waitForSelector('iframe')
  const iframe = await handle.contentFrame()
  await iframe!.waitForSelector('h1')
})
