/* Copy to config.js for local use. Firebase web config is public;
 * Firestore Security Rules enforce user ownership. Never put service-account keys here.
 * Leave FIREBASE null for fully local study. */
window.__CS_CONFIG__ = {
  FIREBASE: null,
  // Replace null with the web app config from Firebase Project settings:
  // { apiKey: '...', authDomain: 'your-project.firebaseapp.com',
  //   projectId: 'your-project', appId: '...', messagingSenderId: '...' },
  OLLAMA_BASE: 'http://localhost:11434',
};
