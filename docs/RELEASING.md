# Deploying cheki.et

cheki.et runs on Vercel from the `main` branch. `vercel.json` turns off
automatic deployments for every other branch (`git.deploymentEnabled`), so a
push to a feature branch costs nothing and only a commit on `main` reaches
production. Run checks locally or in CI before merging.

Publishing SDKs and tagging versions is a separate step (see "Releasing" in
the README). Deploying the site never needs a tag.

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
