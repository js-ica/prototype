# PROTOTYPE

PROTOTYPE turns an early idea into a concise project blueprint. It highlights core prototype features and later additions, then brings feasibility, components, architecture, build steps, and testing together in one section. Download the current blueprint as a paginated PDF or Markdown document. Optional idea clarification, refinement, and a project-specific concept image help develop the concept further.

The concept image prompt is based on the blueprint's most important prototype features. Idea, refinement, and active clarification drafts are saved in the browser's local storage so they can be resumed after a failed request or refresh. Browser speech input is available for both idea entry and refinement when supported.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A Groq API key for clarification, generation, and refinement
- Cloudflare Workers AI account credentials for image generation

## Configure the backend

From the project root, copy `backend/.env.example` to `backend/.env`, then configure `GROQ_API_KEY`, `GROQ_MODEL`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`. The model defaults to `openai/gpt-oss-20b` if `GROQ_MODEL` is omitted. Keep `backend/.env` private and never put provider credentials in frontend variables.

The image route uses the existing Cloudflare Workers AI integration. The frontend may optionally set `VITE_API_BASE_URL`; it defaults to `http://localhost:3001`.

## Voice input compatibility and requirements

Voice input uses the browser's native Web Speech API (`SpeechRecognition` or the prefixed `webkitSpeechRecognition`) for both idea entry and refinement. It does not use a separate PROTOTYPE voice backend or a paid speech API. The feature is browser-dependent: current Chromium-based Chrome and Edge builds commonly expose it; Safari support is version-dependent and may use the prefixed API; Firefox generally does not provide speech recognition. Check the target browser because support and speech-service availability can change by browser, operating system, region, and policy.

Use `localhost` for local development or deploy over HTTPS; microphone access generally requires a secure context. The user must grant microphone permission and have a working microphone. Speech recognition may send audio to the browser vendor's online speech service, so an internet connection may be required and the vendor's privacy/service policies apply. Permission denial, unsupported browsers, unavailable services, no speech, and recognition errors leave typing available as a fallback.

If the browser reports a speech-recognition `network` error after entering its listening state, that is an error from the browser's recognition service, not the PROTOTYPE generation API. Check internet access, VPN/firewall or managed-browser restrictions, browser/OS speech-service availability, and try another supported browser/network. The Web Speech API error does not identify which external connection failed; type the text manually if the service remains unreachable.

### Manual voice acceptance test before deployment

Run the app in each supported target browser using HTTPS (or `localhost`) and a connected microphone:

1. Allow microphone permission. In the initial idea field, start voice input, speak a project idea, then stop or wait for recognition to finish. Confirm the listening/stop state is announced and the transcript appears in the idea field.
2. Edit the recognized idea text. Confirm recognition does not submit or generate anything automatically; click **Generate Blueprint** to submit it through the existing `/api/generate` request.
3. In **Refine Previous Idea**, repeat the test and confirm the transcript appears in the refinement field, remains editable, and is not submitted until **Refine Previous Idea** is clicked.
4. Repeat with microphone permission denied, no speech, and network access to the browser speech service disabled. Confirm an explanatory status appears, the page remains usable, and typing still works. In a browser without Web Speech API support, confirm voice controls are disabled and typing remains available.

Do not treat mocked recognition tests or browser feature detection as a substitute for this real-microphone acceptance test.

## Start the application

In one terminal:

```powershell
Set-Location C:\Users\USER\Downloads\PROROTYPE\prototype\backend
npm start
```

In another terminal:

```powershell
Set-Location C:\Users\USER\Downloads\PROROTYPE\prototype
npm run dev
```

Open the Vite URL printed by the frontend (normally `http://localhost:5173`).

## Verify changes

From the project root, run the frontend checks:

```powershell
npm run build
npm run lint
```

Run backend unit and route-validation tests:

```powershell
Set-Location .\backend
npm test
```

The backend exposes `/api/health`, `/api/clarify`, `/api/generate`, `/api/generate-image`, and `/api/images/:imageName`. Provider requests are rate-limited in memory per client; these limits reset when the backend restarts.

Feasibility and similarity statements are AI-generated estimates, not engineering verification or live market or patent research. The blueprint does not provide a separate roadmap or an automated quality checklist; build steps and testing guidance appear together in Build feasibility.
