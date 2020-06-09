/* eslint-env browser */
/* globals chrome */

import { loadMessage, timestampPath } from './load-message'

// Log load message to browser dev console
console.log(loadMessage)

let timestamp: number | undefined

const id = setInterval(async () => {
  const t = await fetch(timestampPath)
    .then((res) => {
      localStorage.removeItem('chromeExtensionReloaderErrors')
      return res.json()
    })
    .catch(handleFetchError)

  if (typeof timestamp === 'undefined') {
    timestamp = t
  } else if (timestamp !== t) {
    chrome.runtime.reload()
  }

  function handleFetchError(error: any) {
    clearInterval(id)

    const errors = localStorage.chromeExtensionReloaderErrors || 0

    if (errors < 5) {
      localStorage.chromeExtensionReloaderErrors = errors + 1

      // Should reload at least once if fetch fails.
      // The fetch will fail if the timestamp file is absent,
      // thus the new build does not include the reloader
      return 0
    } else {
      console.log('rollup-plugin-chrome-extension simple reloader error:')
      console.error(error)

      return timestamp
    }
  }
}, 1000)
