# Approved Stage 1 save and merge

The owner approved the current Stage 1 website and functionality on 16 October 2026. Further editor styling is deferred. Approved manual footer cream-mask colour, Google Maps link and lighter hover colours are preserved.

The final production build and all 51 individual checks across eight test files pass. Initial failures were stale formatting/presentation expectations; only those assertions were updated, with explicit protection for the approved manual edits. `.gitignore` excludes dependencies, generated output, secrets, temporary files and backup archives. Original source recovery fixtures and backup manifests remain tracked; archives remain on disk and ignored.

## Current verified Git state

Git read operations work. Git writes are blocked by the execution environment: even `git add --dry-run` fails with `Unable to create .../.git/index.lock: Read-only file system`. No staging, commit, tag or merge has occurred. Both `main` and `stage-1-blog-foundation` currently point to `d89943d754e667f8fa5f50251c36bbfb17e84073`. `approved-website-v1` points there unchanged; `approved-stage-1-v1` is absent. Stage 1 work is saved as working files, not yet as a Git checkpoint.

## Complete host-terminal commands

Run this entire block in your own terminal. It uses a subshell, stops on failure, preserves pre-existing tags/branches, stages only reviewed project paths, never pushes and does not start Stage 2. If it stops, send the output before attempting a reset or force operation. An existing staged change stops execution so unrelated staged work is not folded into this commit.

```bash
(
  set -eu
  cd /home/marvel/Projects/ohajiugwo-organic-farms
  test "$(git branch --show-current)" = "stage-1-blog-foundation"
  test "$(git rev-parse 'approved-website-v1^{commit}')" = "d89943d754e667f8fa5f50251c36bbfb17e84073"
  test ! -e "$(git rev-parse --git-path MERGE_HEAD)"
  git diff --cached --quiet
  npm run build
  npm run check
  git diff --check

  git add -- .gitignore HANDOFF.md README.md package.json package-lock.json scripts src tests local-editor docs design-system public
  git diff --cached --check
  git diff --cached --stat
  git diff --cached --name-status
  python3 - <<'PY'
import re, subprocess
paths = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z'], text=True).split('\0')
for path in filter(None, paths):
    forbidden = re.search(r'(^|/)(node_modules|dist|generated|coverage|\.cache|\.aws|\.ssh|\.gnupg|\.codex)(/|$)|(^|/)(\.env(?:\..*)?|\.npmrc|\.netrc|credentials\.json|secrets\.json)$|\.(tar|tar\.gz|tgz|tar\.bz2|tar\.xz|zip|7z|rar|pem|key|p12|pfx|log|tmp|temp|bak|swp|swo)$', path)
    if forbidden:
        raise SystemExit('Unexpected staged file; inspect before committing: ' + path)
print('Staged path exclusion check passed.')
PY
  git commit -m "Complete approved Stage 1 website and blog"
  stage1_commit=$(git rev-parse HEAD)
  if git rev-parse --verify --quiet refs/tags/approved-stage-1-v1 >/dev/null; then
    printf '%s\n' 'Existing approved-stage-1-v1 tag preserved.'
    test "$(git rev-parse 'approved-stage-1-v1^{commit}')" = "$stage1_commit"
  else
    git tag approved-stage-1-v1 "$stage1_commit"
  fi
  test -z "$(git status --porcelain)"

  git switch main
  git merge --ff-only stage-1-blog-foundation
  npm run build
  npm run check
  git diff --check
  test "$(git rev-parse HEAD)" = "$stage1_commit"
  test "$(git rev-parse 'approved-stage-1-v1^{commit}')" = "$stage1_commit"
  test "$(git rev-parse 'approved-website-v1^{commit}')" = "d89943d754e667f8fa5f50251c36bbfb17e84073"
  test -z "$(git status --porcelain)"
  git log -1 --format='%H %s'
  git show-ref --tags approved-website-v1 approved-stage-1-v1
  git status --short --branch
)
```

The staging review above prints every intended file, including fonts, licences, lockfile, source, tests, documentation and historical review screenshots. Inspect the output; no ignored files are force-added. A source credential-pattern scan by the agent found no matches, but cannot guarantee detection of every possible secret.

Expected final state: `main` and `stage-1-blog-foundation` at the same new commit with message **Complete approved Stage 1 website and blog**, `approved-stage-1-v1` at that commit, `approved-website-v1` unchanged and a clean working directory (`## main` only). No branch is deleted. If an existing Stage 1 tag points elsewhere, the comparison fails without moving it. If main has diverged, fast-forward fails without rewriting or discarding either branch; report that output for a merge review.

Paste the final commit, tag and status output back to confirm success. The agent must verify it before creating a separate Stage 2 branch or preparing the Stage 2 implementation plan. No Stage 2 code, external services, production email, paid services, remote push or deployment are authorised here. Handoff's read-only limitation is historical provenance; after successful host execution, the actual Git output establishes the checkpoint and merge.
