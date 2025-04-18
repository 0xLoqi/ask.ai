# Ask.ai — Closed‑Alpha Essentials
_A step‑by‑step blueprint to deliver a **signed, auto‑updating alpha build** to ~20 testers._

When a task is complete, change `- [ ]` → `- [x]`.

---

## 1 · Code Safety
- [x] **Convert codebase to TypeScript**
      - Add strict `tsconfig.json`.
      - Install `typescript`, `ts-node-dev`.
      - Rename all project `.js` → `.ts`; switch to `import / export`.
      - Build must pass `tsc --strict` (use `any` or `@ts‑nocheck` sparingly).
- [x] **Add runtime validation with zod**
      - `AskPayloadSchema` (img, audio?, prompt) in `src/shared/schemas.ts`.
      - Validate `req.body` in `/api/ask`; return 400 on failure.

## 2 · Cost & Latency Guards
- [x] **Client‑side image resize**
      - Resize to `max‑width: 1600`, convert to WebP before upload.
- [x] **Model router**
      - Default: `gpt-4o-mini`.
      - Escalate to `gpt-4o` if prompt > 120 chars **or** user adds "detail" flag.
- [x] **Token & latency logging**
      - Log `model`, `tokens_in/out`, `latency_ms` to a local file (`logs/usage.jsonl`).

## 3 · Voice Parity
- [x] **Whisper Cloud integration**
      - POST base64 WAV to `/v1/audio/transcriptions`.
      - Insert transcript into existing GPT flow.
- [x] **Unified hot‑key & overlay input**
      - Single shortcut (⌘⇧Space / Ctrl⇧Space):
          - **Tap** → show overlay with text box focused.
          - **Hold** → show same overlay + "Listening…" indicator; populate input as you speak.
      - Overlay must support:
          - Streaming transcription into the text box.
          - ESC or double‑tap to cancel.
          - ⌘↵ (or Enter) to submit the final text.
      - Fallback: if mic fails, default to typing mode with a toast "Mic unavailable—typing only."


## 4 · Signed Installer & Auto‑Update
- [x] Add `electron-builder` config:
      - Windows MSIX (self‑signed OK for alpha).
      - macOS DMG + skip notarization for now.
- [x] Enable `autoUpdater` pointing to GitHub Releases.

## 5 · Basic Error Logging
- [x] Global `try/catch` in main & renderer; POST errors to simple webhook (`/api/log`).
- [x] SSE: send `{event:"error",message}` on OpenAI failures.

## 6 · Privacy & Docs
- [ ] Add `PRIVACY.md` section in README:
      - Screenshots & audio auto‑deleted after **24 h**.
      - "We do not sell user data."  Link to OpenAI data policy.
- [ ] Update landing copy: "Ask anything, anywhere, anytime."

---

### Phase 2 (post‑alpha / public pilot)
- Sentry & PostHog telemetry
- Stripe metered billing
- Rate‑limit middleware, EXIF strip
- SOC‑2 / DPA docs
