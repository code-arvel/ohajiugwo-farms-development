# Save the approved website in Git

## Why the agent could not commit

Git is installed and configured. The restricted execution environment exposes `/home/marvel/Projects/ohajiugwo-organic-farms/.git` as an empty, read-only directory (mode 555) and grants read-only repository-metadata access. No `HEAD` is visible, so Git cannot recognise the repository here. This is not evidence that Git is missing or that the unrestricted laptop has no repository.

Run the following commands in your own laptop terminal. They initialise a repository only if Git cannot find one, stop if the detected repository belongs to a parent folder, and preserve existing staged work. They do not change Git identity, remotes, the approved website or the backup. Nothing is pushed or published.

## 1. Check, initialise if needed, validate and stage

```bash
bash <<'SH'
set -eu
cd /home/marvel/Projects/ohajiugwo-organic-farms

git --version
git config --get user.name
git config --get user.email

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

if [ "$(git rev-parse --show-toplevel)" != "$(pwd -P)" ]; then
  echo 'Repository root differs from this project. Stop and inspect before staging.'
  exit 1
fi

git status --short
if ! git diff --cached --quiet; then
  echo 'Existing staged changes found. Review them before staging this checkpoint.'
  git diff --cached --stat
  exit 1
fi

if [ -n "$(git ls-files -ci --exclude-standard)" ]; then
  echo 'Previously tracked files now match .gitignore. Review these before committing:'
  git ls-files -ci --exclude-standard
  exit 1
fi

npm run build
npm run check

git add -- .gitignore package.json README.md HANDOFF.md \
  src public scripts tests docs design-system \
  backups/*.mjs backups/*-README.md backups/*-source-sha256.json

git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git status --short
SH
```

If previously tracked generated files, archives or secrets are reported, inspect them and use `git rm --cached -- path/to/file` only for the paths that should stop being tracked. That removes them from Git's index while preserving local files. Recheck staged changes before continuing. Do not delete the backup or reset unrelated work.

Review the staged filenames and, where needed, the content with `git diff --cached`. Source, assets, design-system files, documentation and recovered source fixtures should be included. `dist/`, `node_modules/`, backup archives, secrets and temporary files should be absent. The public company email is intentional website configuration.

## 2. Commit, tag only if absent, and confirm status

After reviewing the staged files:

```bash
bash <<'SH'
set -eu
cd /home/marvel/Projects/ohajiugwo-organic-farms

git diff --cached --check
git commit -m "Save approved farm website"

if git show-ref --verify --quiet refs/tags/approved-website-v1; then
  echo 'Tag approved-website-v1 already exists; preserved without moving it.'
else
  git tag approved-website-v1
fi

git log -1 --format='%H %s'
git show-ref --verify refs/tags/approved-website-v1
git log -1 --format='%H %s' approved-website-v1
git status --short
git status --branch
SH
```

The first log is the new commit; the tag reference and second log identify the existing or newly created tag target. If the tag already existed, it can legitimately identify an older commit; do not force-move it. Empty `git status --short` output indicates a clean working directory. Any unrelated remaining changes should be reviewed and preserved rather than reset or added blindly.

No push or deployment command is included. The approved recovery archive remains unchanged at `backups/approved-website-20261016T025450Z.tar.gz`.
