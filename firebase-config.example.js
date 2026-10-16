/**
 * Copy to firebase-config.js (gitignored) and fill in from Firebase Console.
 * Do NOT commit real values. Admin owns this file in production inject.
 *
 * Load order (when ready): firebase-config.js → Firebase SDK → auth.js → app
 */
window.__FIREBASE_CONFIG__ = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  appId: "YOUR_APP_ID",
  // storageBucket: "YOUR_PROJECT.appspot.com",
  // messagingSenderId: "YOUR_SENDER_ID",
};
