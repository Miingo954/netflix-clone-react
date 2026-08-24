import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCxBdI2tBUUsdTW8cFE8pN5bx4W9faed4Q',
  authDomain: 'fir-practice-e819c.firebaseapp.com',
  projectId: 'fir-practice-e819c',
  storageBucket: 'fir-practice-e819c.firebasestorage.app',
  messagingSenderId: '625485799298',
  appId: '1:625485799298:web:5d471088f61a3007d9b99b',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
