# Firebase setup for Cert Study

Local quizzes, confidence ratings, focus recommendations, resume, and progress backups work before you configure Firebase. Firebase adds Google sign-in and cross-device sync. No custom server or Firebase Hosting migration is required.

## Console setup

1. Open https://console.firebase.google.com/ and create a project. You can start with Spark (no billing account). Analytics is optional and is not used by this app.
2. Register a **Web app**. Copy its `firebaseConfig` object from Project settings → General → Your apps. Use the **web app config**, never a service account JSON/private key.
3. Under Authentication → Sign-in method, enable **Google**, choose a support email, and save.
4. Under Authentication → Settings → Authorized domains, add your site's hostname. For GitHub Pages that is `alta01.github.io` (no protocol or `/Cert-study/` path). Add `localhost` explicitly if you test locally; newer projects may not include it by default.
5. Under Firestore Database, create the **default Cloud Firestore database in Standard edition**, choose the location you want, and start in **production mode**.
6. In Firestore → Rules, replace the editor contents with [`firebase/firestore.rules`](../firebase/firestore.rules) and click **Publish**. These rules restrict progress to the authenticated owner and prevent changes to saved answer records. Do not use test-mode rules.

## GitHub Pages configuration

In `alta01/Cert-study`, open Settings → Secrets and variables → Actions → **Variables**. Create the repository variable **`FIREBASE_CONFIG`**, containing JSON like:

```json
{"apiKey":"YOUR_WEB_API_KEY","authDomain":"YOUR_PROJECT.firebaseapp.com","projectId":"YOUR_PROJECT","appId":"YOUR_WEB_APP_ID","messagingSenderId":"YOUR_SENDER_ID"}
```

Use your real values from step 2. The workflow reads a **variable**, not a secret. These values are public browser configuration; rules protect the data. Leave the variable unset to deploy a local-only app. Older `SUPABASE_*` secrets are unused.

Merge the code into `main` after its parent PRs, or run the Pages workflow on the branch you intend to publish. The workflow serializes configuration with `jq`, runs learning tests, and validates exam files. The app's current hosting path can stay the same.

## Local / Docker / Kubernetes configuration

- **Local:** copy `config.example.js` to `config.js`. Replace `FIREBASE: null` with the web config object. Run `npm run serve`; open `http://localhost:3000`. Blank configuration disables Firebase calls entirely.
- **Docker:** set the environment variable `FIREBASE_CONFIG` to the JSON object in `.env` or the environment. The entrypoint generates `config.js` safely with `jq`. `docker compose up --build` rebuilds the app.
- **Kubernetes:** create `cert-study-firebase` with a `config` key holding the JSON. See the commented command in `k8s/cert-study-deployment.yaml`, then roll out the updated image. The secret stores public config for operational convenience.

## Verify after deployment

1. In guest mode, answer a question, set confidence, submit, and exit early. Open Progress: the answer should already affect the focus list.
2. Sign in with Google. Guest and account data are intentionally separate. Use Account → **Import this device’s guest progress** if you want to copy the guest/legacy data into your account.
3. Check that the status becomes **Progress synced**. On a second device, sign into the same account and use **Sync now**. Confirm the answer history and unfinished session appear.
4. Disconnect the network, answer another question, and exit. Reconnect and use **Sync now**. Check the answer appears once on the other device.
5. Start focused practice while a regular quiz is unfinished. Both should be independently resumable from Home.
6. Export progress, import it twice, and confirm answer counts do not increase from duplicates.
7. Sign out and verify the account's history is hidden in guest mode. Sign into a different account and verify the first account's history is not imported automatically.

Google sign-in uses a popup to avoid cross-domain redirect-storage problems on static hosting. Allow popups for the site. Test Safari and the installed iOS PWA; if the PWA blocks the popup, sign in from a normal browser tab. A user-initiated popup error appears in the status text.

## Data layout and behavior

Firestore uses `users/{uid}/answers/{eventId}`, `users/{uid}/attempts/{attemptId}`, and `users/{uid}/sessions/{examAndMode}`. Each submitted answer is an immutable document. Session updates use a transaction that keeps the newer `savedAt`; cleared sessions have tombstones so an older device cannot immediately resurrect them. Avoid changing device clocks, since session conflict resolution uses client timestamps. Sync occurs on sign-in, reconnect, or **Sync now**; answers are also pushed immediately after local saving. This is not a continuous live collaboration feed.

The browser stores account-scoped answer records in IndexedDB and sessions/score history in localStorage. If IndexedDB is unavailable, a visible notice explains the localStorage fallback. Browser storage can be cleared or evicted: use **Export progress** for a portable backup. The backup excludes Firebase tokens and credentials, but contains your study answers; keep it private as needed.

The old Supabase client and SQL schema are no longer loaded or used. Existing `cs_sess_*` and `cs_hist_*` local data is copied once into the guest profile. Completed historical quizzes do not contain per-question confidence, so that information cannot be reconstructed. Copying local data to Firebase requires the explicit guest-import action. Data that existed only in the unavailable Supabase project cannot be recovered by this app.

Cloud free quotas apply. The app fetches progress collections on manual/startup sync, so users with very large histories should consider paginated/incremental sync before scaling. It keeps the most recent 200 completed quiz summaries locally; the answer log is separate and is not truncated by that cap.

## Tests and reference documentation

- `npm test`: learning rules, persistence isolation, migration/import validation, and mocked Firebase adapter behavior.
- `npm install` then `npx playwright install chromium` and `npm run test:browser`: automated local browser acceptance tests (no Firebase credentials needed).
- Live Google OAuth, deployed Firestore rules, and real device sync require your Firebase project and the checks above. Mocked tests do not establish that live rules have been published.

Official documentation:
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/redirect-best-practices
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/pricing
