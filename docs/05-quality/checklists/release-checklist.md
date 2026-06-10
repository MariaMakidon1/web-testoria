# Release Checklist

Steps to verify before deploying to production.

---

## Pre-deploy verification

- [ ] All PR checklists completed for merged PRs since last release
- [ ] `main` branch is green (CI passes: lint, type check, unit tests)
- [ ] `npm run test:e2e` passes against a staging environment
- [ ] `npm run build` succeeds locally (production build, not just dev)
- [ ] No known critical bugs open for this release

## Environment

- [ ] `.env` / secrets confirmed for production (VITE_API_URL, etc.)
- [ ] Backend API is deployed and healthy before deploying frontend

## Static build

- [ ] `npm run build -- --mode prod` produces a clean `dist/`
- [ ] If `deploy/web.vhost.conf` changed, `nginx -t` passes on the host after install
- [ ] SPA routing works — navigating to a deep URL (e.g. `/test-cases/1`) serves `index.html` (host nginx `try_files … /index.html`)

## Deployment

- [ ] Host prerequisites in place (see `api-testoria/deploy/README.md`): nginx + certbot installed, web cert issued, `/var/www/testoria` + scoped deploy-sudo configured
- [ ] Run the `Pipeline` workflow (`workflow_dispatch`); it builds `dist/`, ships it, flips the `current` symlink, installs the vhost, and reloads nginx
- [ ] Deployment completes without errors in GitHub Actions logs
- [ ] `https://testoria.gammait.net/health` returns 200 and the app loads in browser

## Post-deploy smoke test

- [ ] Login works
- [ ] Dashboard loads
- [ ] Can view a project and its test cases
- [ ] Can create a test run and record a result
- [ ] Can view reports
- [ ] Dark mode toggle works
- [ ] Logout works

## Rollback plan

- [ ] Previous release kept under `/var/www/testoria/releases/` (CI retains the last 5)
- [ ] Rollback = repoint the symlink to the prior release: `sudo ln -sfn /var/www/testoria/releases/<prev-sha> /var/www/testoria/current` (no nginx reload needed for static files), or re-run the workflow on the prior commit
