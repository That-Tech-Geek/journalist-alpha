import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate config to prevent cryptic auth/invalid-api-key errors
const isConfigValid = !!firebaseConfig.apiKey;

if (typeof window !== 'undefined' && !isConfigValid) {
  console.error(
    "🔥 FIREBASE CONFIG ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is missing!\n" +
    "If you are on Vercel, you MUST trigger a new deployment without build cache " +
    "after adding environment variables, because NEXT_PUBLIC_ vars are baked in at build time."
  );
}

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth only on the client side and only if config is valid
const auth = (typeof window !== 'undefined' && isConfigValid) ? getAuth(app) : null as any;
const googleProvider = (typeof window !== 'undefined' && isConfigValid) ? new GoogleAuthProvider() : null as any;

export { app, auth, googleProvider };
