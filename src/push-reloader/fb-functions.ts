// Firebase manual chunk
import fb from 'firebase/app'
import 'firebase/auth'
import 'firebase/functions'

import { config } from './CONFIG'

// Initialize full web app on import
export const firebase = fb.initializeApp(config, 'reloader')

export const login = async () => {
  const { user } = await firebase.auth().signInAnonymously()

  return user?.uid
}

export const update = firebase
  .functions()
  .httpsCallable('updateUserTime')

export const reload = firebase
  .functions()
  .httpsCallable('reloadClient')
