# Cloudflare Images — remote development verification

Verified 27 October 2026 against the existing account, using Wrangler 4.151.1 and the existing image-processor source/configuration. This is **remote development provider evidence**, separate from local mocks and the deployed authenticated media workflow.

## Execution and limits

- Started `wrangler dev --remote` for the existing internal image processor with its `IMAGES` binding. No production script, route, account plan or public `workers.dev` endpoint was changed. No Supabase credentials, account, email, Storage object or administrator session was used.
- The initial direct request returned 404 because Wrangler's development transport did not preserve the production handler's exact internal URL. A temporary development-only wrapper then reconstructed `https://farm-image-processor.internal` and called the **unchanged** exported `createImageProcessorRequestHandler`. It preserved method/body/headers and the production URL guard; it was not added to production code.
- Generated a deterministic 32×16 RGBA PNG with a dummy `tEXt` comment, using Python standard-library PNG/zlib encoding. No customer/farm photograph was uploaded. Fixture and downloaded outputs were temporary files only.
- Sent POST `/process` with `Content-Type: image/png`, `X-Max-Dimension: 32`. Actual remote Images calls returned HTTP 200, `application/octet-stream`, width 32, height 16, two 70-byte derivatives, and a 140-byte combined payload. Advertised boundaries matched actual bytes.
- Parsed both outputs' RIFF/WebP containers: correct container sizes, VP8 chunks, decoded width/height 32×16, no EXIF/XMP/ICC chunks, and no dummy PNG comment. This demonstrates metadata absence for this fixture; it does not substitute for JPEG/EXIF, animation or large-file tests.
- Repeated with max dimension 16: HTTP 200, reported original 16×8, private/no-store response. Unsupported `image/svg+xml` returned 400; 20 malformed PNG bytes returned 503 with generic failure and no-store. No output image was returned for failures.
- Both remote development processes were stopped after their checks. No schedule or always-running development process was left active.

Cloudflare documents both the high-fidelity remote development binding and that development Images use incurs no usage charges: [Images binding](https://developers.cloudflare.com/images/optimization/binding/). No paid action was selected.

## Deployment scope inspected separately

A fresh authenticated read of the existing Pages project through Cloudflare's API returned:

| Environment | Image service binding | Administrator runtime variables |
| --- | --- | --- |
| Preview | `MEDIA_PROCESSOR` → `ohajiugwo-image-processor-development` | Twelve configured names; values withheld |
| Production | No `services` entry | Empty |

The API field is `deployment_configs.<environment>.services`, not `service_bindings`. This resolves the old downloaded-config ambiguity for the current account/project state. No setting was changed by inspection.

## Remaining verification

This does not prove the deployed Pages-to-Worker call under a real app session, real private upload/reservation/download/delete, saved-media reference protection, cleanup/reconciliation, concurrency, provider CPU/memory behavior on large photographs, animation handling, all metadata formats, or production readiness. Those gates stay open in the Stage 2 checklist. A real first administrator and separately approved account/email actions are still needed for the authenticated flow.
