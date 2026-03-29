import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth only on the client side
const auth = typeof window !== 'undefined' ? getAuth(app) : null as any;
const googleProvider = typeof window !== 'undefined' ? new GoogleAuthProvider() : null as any;

export { app, auth, googleProvider };
