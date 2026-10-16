# Deploying cheki.et

cheki.et runs on Vercel from the `main` branch. `vercel.json` turns off
automatic deployments for every other branch (`git.deploymentEnabled`), so a
push to a feature branch costs nothing and only a commit on `main` reaches
production. Run checks locally or in CI before merging.

Publishing SDKs and tagging versions is a separate step (see "Releasing SDKs"
below). Deploying the site never needs a tag.

## Before merging to main

```bash
npm ci
npx vitest run
npx tsc --noEmit
npm run lint
npx next build
(cd python && pip install -e ".[dev]" && pytest)

# Smoke-test the production build locally
npx next start -p 3000 &
npm run smoke                       # defaults to http://localhost:3000
npm run link-audit                  # every sitemap page has an in-content inbound link
```

## Smoke test

`scripts/smoke.ts` takes a base URL (argument or `SMOKE_BASE_URL`) and exits 1
if any check fails:

```bash
npm run smoke -- https://cheki.et
npm run smoke -- https://<deployment>.vercel.app
```

It checks:

- `/`, `/banks/cbe`, `/status` and `/endpoints` answer 200 with HTML
- `/api/health` answers 200 with `status: "ok"` and a bank list
- a bad `/api/verify` request (an unsafe reference, and a non-object body) gets
  a clean 4xx and never `success: true` or `verified: true`
- an old URL (`/verify/verify-cbe-receipt-online`) answers 301 to `/banks/cbe`

It sends no real receipt references, so it is safe against production.

## After a deploy: ping IndexNow

Once a deploy that adds or changes pages is Ready on production and the smoke
test passed, tell the IndexNow engines (Bing and the others that share
submissions; Google does not take part) to recrawl:

```bash
npm run indexnow -- --dry-run       # prints the payload, sends nothing
npm run indexnow                    # POSTs every https://cheki.et/sitemap.xml URL
```

- Run it only after the merge to `main` is deployed. Never against a preview
  URL or before the deploy: it reads the live sitemap, and it refuses to post
  unless `https://cheki.et/{key}.txt` is live and holds the key.
- The key is `INDEXNOW_KEY` in `scripts/lib/indexnow.ts`; the matching file is
  `public/{key}.txt`. The protocol needs the file publicly served, so the key
  only proves we control the host; it is not a credential. To rotate it, change both in one commit and deploy before the next
  submission.
- A 200 or 202 answer is success (202: the key is still being validated). On
  403 the key file is missing or wrong on production; 429 means "too many
  requests (potential spam)", so wait before retrying. Run it once per deploy
  that adds or changes pages, not on every deploy.
- Google still needs the sitemap in Search Console; IndexNow does not reach it.

## Shipping several dependent PRs at once

When PRs only work together (a stack), production must never build an
intermediate `main`:

1. Note the current production deployment id (Vercel dashboard, or
   `GET /v6/deployments?projectId=…&target=production&limit=1`). That is the
   rollback target.
2. Pause builds: set the project's Ignored Build Step to `exit 0`
   (Settings → Git, or `PATCH /v9/projects/{id}` with
   `{"commandForIgnoringBuildStep": "exit 0"}`). Every push, including the
   daily `status.json` commit, is then skipped.
3. Merge the PRs in order with merge commits, and wait for CI on `main`.
4. Restore the Ignored Build Step to its previous value (unset by default).
5. Redeploy `main` once and wait until it is Ready.
6. Run `npm run smoke -- https://cheki.et`.

## Rolling back

If the smoke test fails on anything that touches verification or pages:

1. **Instant Rollback** to the recorded deployment: Vercel dashboard →
   Deployments → that deployment → Instant Rollback, or
   `POST /v10/projects/{projectId}/promote/{deploymentId}`. This takes seconds
   and needs no build.
2. Revert the merge commit(s) on `main` (`git revert -m 1 <sha>`) in a PR, so
   the next build matches what is live.
3. Note that after an Instant Rollback, Vercel stops auto-assigning new
   production deployments to the domain until one is promoted again.

## Releasing SDKs

Every package carries the same version: the web app, npm `cheki-verify` (and
`@1rb/cheki-verify` on GitHub Packages), PyPI `cheki`, Packagist
`cheki/cheki`, pub.dev `cheki` and the Go module
`github.com/1RB/cheki/sdks/go`. `tests/sdk/version-sync.test.ts` fails CI if
any version line or SDK constant drifts.

`main` only takes merge commits from PRs, so a release is a PR plus a tag:

1. On a branch, run `./scripts/bump-version.sh --files-only X.Y.Z`. It
   rewrites `package.json`, `package-lock.json`, `sdks/typescript/package.json`,
   the TypeScript `VERSION` (src and committed build), `python/pyproject.toml`,
   `python/cheki/_version.py`, the PHP `VerifyOptions::VERSION`,
   `sdks/dart/pubspec.yaml`, the Dart `chekiSdkVersion`, the Go `Version`
   constant and the pinned `go get ...@vX.Y.Z` in `sdks/go/README.md`. Every
   SDK builds its User-Agent from that constant. `composer.json` has no
   version: Packagist reads the tag.
2. Add a `## X.Y.Z` entry to `CHANGELOG.md` and to `sdks/dart/CHANGELOG.md`
   (pub.dev shows it), open the PR and merge it once CI is green.
3. On the merged `main` (clean and equal to `origin/main`), run
   `./scripts/bump-version.sh --tag-only X.Y.Z`. It refuses unless every file
   above already carries X.Y.Z and both changelogs have the entry, creates two
   annotated tags on `HEAD`, `vX.Y.Z` and `sdks/go/vX.Y.Z`, and pushes them in
   one atomic push. It refuses an existing tag. Never move or delete a pushed
   tag: registries keep what they first saw (Packagist's 1.4.1 is still the
   June 2026 commit the `v1.4.1` tag pointed at before it was moved).

   `./scripts/bump-version.sh X.Y.Z` (no flag) still does all of it in one go
   on `main` (bump, commit, tag, push `main` and both tags) for repos where a
   direct push to `main` is allowed.
4. Create a GitHub Release for `vX.Y.Z` with the changelog entry as notes.
5. The `vX.Y.Z` tag runs `.github/workflows/publish.yml`:

| Job | Registry | Auth |
|-----|----------|------|
| `publish-npm` | npm `cheki-verify` | npm trusted publishing (GitHub OIDC), no secret |
| `publish-github-packages` | `@1rb/cheki-verify` | `GITHUB_TOKEN` |
| `publish-pypi` | PyPI `cheki` | `PYPI_TOKEN` secret |
| `publish-packagist` | Packagist `cheki/cheki` (reads the tag) | `PACKAGIST_TOKEN` secret |
| `publish-pub-dev` | pub.dev `cheki` | GitHub OIDC, no secret |
| `warm-go-proxy` | proxy.golang.org / pkg.go.dev | none |
| `verify-registries` | all of the above | `GITHUB_TOKEN` (GitHub Packages read) |

- Versions are immutable on every registry. A publish job **fails** when its
  registry already has the version, unless the workflow is being re-run
  (`run_attempt > 1`, after a partial failure), in which case it skips that
  registry with a notice. Nothing is skipped silently.
- `publish-pypi` runs the tests, `twine check --strict`, and checks that the
  wheel ships `LICENSE` and needs only `requests`/`urllib3` at runtime.
  `publish-packagist` runs `scripts/check-php-dist.sh` first (the archive
  Packagist installs holds only the PHP SDK and autoloads).
- `verify-registries` runs after all of them (even if one failed) and polls
  for up to 10 minutes with `scripts/check-registries.mjs`: npm and PyPI
  `latest`, the Packagist p2 metadata (version and commit), pub.dev `latest`,
  the Go proxy `.info` (version and commit) and GitHub Packages. It fails the
  workflow unless every registry serves the release from the tagged commit,
  and writes a table to the job summary. Run it by hand any time:
  `node scripts/check-registries.mjs 1.5.0` (add `--once` to skip polling,
  `--only npm` to check one registry).

### npm (trusted publishing)

- `publish-npm` has no token. npmjs.com → `cheki-verify` → Settings →
  Trusted publishing has a GitHub Actions publisher: organization `1RB`,
  repository `cheki`, workflow filename `publish.yml`, no environment, and
  **Allow npm publish** ticked. The job has `id-token: write`, installs npm 11
  (trusted publishing needs npm >= 11.5.1 and Node >= 22.14.0) and runs
  `npm publish --access public`; npm swaps the GitHub OIDC token for a
  short-lived publish token and attaches a provenance attestation on its own.
- `package.json` `repository.url` must stay `git+https://github.com/1RB/cheki.git`:
  npm rejects a trusted publish whose repository does not match.
- The `NPM_TOKEN` repository secret is no longer used. Delete it (Settings →
  Secrets and variables → Actions) once a trusted publish has worked, and
  optionally set Publishing access on npmjs.com to "Require two-factor
  authentication and disallow tokens".
- A new trusted publisher must complete its first publish within 2 days or it
  expires (delete it and add it again).
- Staged publishing is an option: a stage-only publisher plus
  `npm stage publish` makes each CI publish wait for a maintainer to approve
  it with 2FA on npmjs.com. This repo publishes directly.

#### Publishing an existing tag to npm (workflow_dispatch)

A tag whose own `publish.yml` could not publish to npm (`v1.5.0` still runs
the old `NPM_TOKEN` workflow) is published by dispatching the current
workflow: Actions → **Publish SDKs** → **Run workflow**, branch `main`,
`tag` = `v1.5.0`. That run uses the workflow file from `main`, checks out the
tag's code, runs the same checks (tag matches `package.json`, committed build
matches `src`) and publishes to **npm only**: GitHub Packages, PyPI,
Packagist, pub.dev and the Go proxy are skipped (pub.dev only accepts tag
pushes). If npm already has the version, the run skips it with a notice
instead of failing. `verify-registries` then checks npm only. The provenance
attestation names the commit the workflow ran from (`main`), not the tag.

### Retiring a bad version

Never re-publish over a version. Release a fixed patch version, then point
users away from the old one (needs the registry owners' credentials, not CI):

```bash
npm deprecate cheki-verify@"<1.5.0" "Outdated build: upgrade to cheki-verify 1.5.0 or newer"
# PyPI: Manage project → Releases → Options → Yank (with a reason), per version
# Packagist and pub.dev: mark the package version as retracted/abandoned only if broken
```

### pub.dev (Dart)

- `publish-pub-dev` calls the official reusable workflow
  `dart-lang/setup-dart/.github/workflows/publish.yml@v1` with
  `working-directory: sdks/dart` and `id-token: write`. It runs `dart pub get`,
  `dart pub publish --dry-run`, then `dart pub publish -f`.
- pub.dev accepts the upload only because automated publishing is enabled on
  https://pub.dev/packages/cheki/admin: GitHub Actions, repository `1RB/cheki`,
  tag pattern `v{{version}}`. The pushed tag must therefore equal the pubspec
  version, and the workflow must be started by the tag push itself
  (`workflow_dispatch` is not accepted).
- The first version (1.4.1) was uploaded by hand, as pub.dev requires.
- CI runs `dart pub publish --dry-run` in the `Dart SDK` job, so a pubspec
  problem (more than 5 topics, a topic outside `[a-z0-9-]`, a missing LICENSE
  or CHANGELOG) fails the PR instead of the release. Topics today: ethiopia,
  payments, receipt, verification, api.

### Go

- A module in a subdirectory is versioned by tags with its path as prefix:
  `sdks/go/vX.Y.Z`. That tag does not match `v*`, so it never starts the
  publish workflow on its own.
- There is nothing to upload. `warm-go-proxy` checks that `sdks/go/vX.Y.Z`
  exists and requests
  `https://proxy.golang.org/github.com/1%21r%21b/cheki/sdks/go/@v/vX.Y.Z.info`
  (the proxy case-encodes `1RB` as `1!r!b`), so pkg.go.dev lists the version
  without waiting for a first `go get`.
- Never move or delete a pushed Go tag: the proxy and the checksum database
  cache it forever. Fix forward with a new patch version.

