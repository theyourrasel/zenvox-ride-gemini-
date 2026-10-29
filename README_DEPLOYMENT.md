# ZenvoX Ride — Two-Service Deployment

## Frontend (Render Static Site)
- Root Directory: leave blank (repository root)
- Build Command: leave blank
- Publish Directory: `.`
- Frontend files: `index.html`, `style.css`, `script.js`, `config.js`

## Backend (Render Web Service)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Add environment variables:
  - `GEMINI_API_KEY` = your Google Gemini API key (secret; never put it in frontend files)
  - `FRONTEND_ORIGIN` = the exact Static Site origin, e.g. `https://your-site.onrender.com` (no trailing slash). Multiple exact origins can be comma-separated.
  - Optional `GEMINI_MODEL` = `gemini-2.5-flash`
  - Optional `MAX_UPLOAD_MB` = `12`

After backend deploy, open its `/health` URL. It should return JSON with `ok: true`.
Then edit `config.js` and replace `https://YOUR-BACKEND-SERVICE.onrender.com/api/ai/chat` with the actual backend URL, commit/push, and redeploy the Static Site.

## Current app behavior and required service setup
- YouTube search needs a YouTube Data API v3 key. Use the in-app Configure API option; restrict the key by HTTP referrer and API in Google Cloud Console. Video playback is embedded using the official YouTube player.
- AI chat and supported attachments go through the backend using the Google Gemini API; no AI key should be exposed in `script.js` or `config.js`.
- One-to-one audio/video calling uses WebRTC signaling via Firebase Realtime Database in the existing app. Add a valid Firebase web configuration in the code and configure Firebase Authentication/Realtime Database rules before public use. A TURN service may be required for reliable calls across restrictive networks.
- Group voice rooms are not production-ready in this package. They need room membership, authenticated signaling, peer connection lifecycle management, and preferably TURN. Do not advertise group calling as working until tested with multiple real devices/networks.
- Rider/passenger matching, booking, payments, safety workflows, and social posts must be backed by authenticated database rules and server-side validation before real public launch; client-side demo data is not a production marketplace.

## Security notes
- Never commit `.env` or provider secrets. `.env.example` is safe documentation only.
- Restrict API keys, configure quotas, validate Firebase rules, and test on at least two devices.
