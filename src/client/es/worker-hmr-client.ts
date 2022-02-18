/* eslint-disable @typescript-eslint/no-unused-vars */

// This fixes `self`'s type.
declare const self: ServiceWorkerGlobalScope
export {}

import type { HMRPayload } from 'vite'

// injected by the hmr plugin when served
declare const __BASE__: string
declare const __HMR_PROTOCOL__: string
declare const __HMR_HOSTNAME__: string
declare const __HMR_PORT__: string
declare const __HMR_TIMEOUT__: number
declare const __SERVER_PORT__: string

/* -------- REDIRECT FETCH TO THE DEV SERVER ------- */

const ownOrigin = new URL(chrome.runtime.getURL('/')).origin
self.addEventListener('fetch', (fetchEvent) => {
  const url = new URL(fetchEvent.request.url)
  if (url.origin === ownOrigin) {
    fetchEvent.respondWith(sendToServer(url))
  }
})

/**
 * Sending extension page requests to the dev server via fetch handler.
 *
 * HMR requires fetching extension page code from the dev server, but the
 * default extension CSP does not allow remote code. We should be able to relax
 * the extension CSP, but Chromium currently ignores custom CSP's:
 * https://bugs.chromium.org/p/chromium/issues/detail?id=1247690#c_ts1631117342
 */
async function sendToServer(url: URL): Promise<Response> {
  // change the url to point to the dev server
  url.protocol = 'http:'
  url.host = 'localhost'
  url.port = __SERVER_PORT__
  // add a timestamp to force Chrome to do a new request
  url.searchParams.set('t', Date.now().toString())
  // URLSearchParams adds "=" to every empty param & vite doesn't like it
  const response = await fetch(url.href.replace(/=$|=(?=&)/g, ''))
  // circumvent extension CSP by creating response from extension origin
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'text/javascript',
    },
  })
}

/* ----------- CONNECT TO CONTENT SCRIPTS ---------- */

const ports = new Set<chrome.runtime.Port>()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === '@crx/client') {
    ports.add(port)
    port.onDisconnect.addListener((port) => ports.delete(port))
    port.onMessage.addListener(handlePortMessage)
  }
})

type PortMessage = { type: 'init'; url: string }
function handlePortMessage(message: PortMessage) {
  console.log('port message', message)
}
function notifyContentScripts(payload: HMRPayload | { type: 'ping' }) {
  for (const port of ports) port.postMessage(payload)
}

/* ----------- CONNECT TO VITE DEV SERVER ---------- */

console.log('[vite] connecting...')

// use server configuration, then fallback to inference
const socketProtocol =
  __HMR_PROTOCOL__ || (location.protocol === 'https:' ? 'wss' : 'ws')
const socketHost = `${__HMR_HOSTNAME__ || location.hostname}:${__HMR_PORT__}`
const socket = new WebSocket(`${socketProtocol}://${socketHost}`, 'vite-hmr')
const base = __BASE__ || '/'

// Listen for messages
socket.addEventListener('message', async ({ data }) => {
  handleSocketMessage(JSON.parse(data))
})

function handleSocketMessage(payload: HMRPayload) {
  notifyContentScripts(payload)
  console.log('[vite]', payload)
  switch (payload.type) {
    case 'connected':
      console.log(`[vite] connected.`)
      // proxy(nginx, docker) hmr ws maybe caused timeout,
      // so send ping package let ws keep alive.
      setInterval(() => socket.send('ping'), __HMR_TIMEOUT__)
      break
    case 'custom':
      if (payload.event === 'runtime-reload') chrome.runtime.reload()
      break

    default:
      console.log(payload)
      break
  }
}

async function waitForSuccessfulPing(ms = 1000) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fetch(`${base}__vite_ping`)
      break
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, ms))
    }
  }
}

// ping server
socket.addEventListener('close', async ({ wasClean }) => {
  if (wasClean) return
  console.log(`[vite] server connection lost. polling for restart...`)
  await waitForSuccessfulPing()
  location.reload()
})
