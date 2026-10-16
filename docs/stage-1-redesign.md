# Stage 1 journal and writing editor

Owner-approved design, 16 October 2026. Existing branch `stage-1-blog-foundation`; recovery tag remains `d89943d754e667f8fa5f50251c36bbfb17e84073`.

Reference inspected: https://source.ghost.io/ and https://source.ghost.io/plastic-pollution-crisis-deepens/ (live listing, article header/cover/body). Adapt the editorial hierarchy, not its branding, assets, theme code or backend.

- Listing: compact Farm Journal introduction, featured split image/text, remaining posts once each in smaller cards; phone stacking; calculated reading times.
- Article: restrained title/header, metadata and optional supplied author, balanced cover, comfortable reading column, related published posts and return link. Email in blog-only shared footer. No public sample/development notices or metadata.
- Editor: sidebar and post list, dedicated writing screen, title/excerpt plus a cohesive Tiptap area; only paragraphs, H2/H3, bullet/numbered lists, safe links and undo/redo. Settings separate; Save/status clear; Tools holds export/import/reload/reset. Mobile navigation drawer and settings panel. Keep company/products/services editing.
- Use only free MIT Tiptap/ProseMirror components bundled locally with esbuild. No Ghost, framework migration, paid extensions, collaboration service or CDN runtime.
- Persist validated structured JSON; upgrade earlier block documents without losing content. Keep legacy imports/browser storage. Reject unsafe links/unsupported nodes. Existing local save/conflict/unsaved-change behaviour remains.
- All local editorial records are review-only. Production generation rejects review-only or unclassified legacy records even if marked published. Existing global launch gate stays closed.
- Scope CSS under `.blog-page` and `.editor-page`; no changes to approved base CSS/homepage. Editor assets remain outside dist and unavailable in production preview.

Implementation sequence: content conversion/validation tests → journal templates/styles → locally bundled writing UI and storage → automated and actual browser checks → HANDOFF update and owner review. No Stage 2, accounts, hosting configuration or deployment.

Verification: published-only selection/no featured duplicates; reading times; related exclusions; optional author; old/new JSON round-trip; safe-link and paste sanitisation; save/import/export/conflicts/unsaved protection; phone/desktop layouts; full homepage golden comparison; build/editor isolation and production guard.
