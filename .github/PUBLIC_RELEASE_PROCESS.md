# Unfire website — production release procedure

**Published branch:** `gh-pages` (not `main`)  
**Domain:** `https://unfire.technology/`  
**Effective:** 7 November 2026

## One integrator, one reviewed change

1. Begin from the current `gh-pages` SHA. Confirm the release owner, affected files, and any other active leases or dependent work. Never force-push or reset another owner's branch.
2. Make a narrowly scoped change on a separate branch and open a PR **targeting `gh-pages`**. A merge to `main` alone does not publish the website.
3. Confirm the unconditional `production-preflight` check has passed against the PR's current merge result. It validates the site structure and runs the existing pilot intake privacy, CSP and audio commerce tests.
4. Run additional **change-specific tests**, including real browser/device tests when claiming compatibility. The common preflight does **not** certify ownership, trademark rights, accessibility, full application security or operational readiness.
5. For any audio, game, fonts, images, voice, music, video, third-party code, payment or app material, obtain the relevant owner's documented source/licence/redistribution and quality signoff **before** merging. Do not import an unreleased `main` tree wholesale into `gh-pages`.
6. Merge only the approved PR after the exact SHA passes CI. Verify both the Pages **build and deploy** jobs are successful; a green build without a successful deployment is not enough.
7. Confirm the intended live HTTPS URL, functional behavior and expected content SHA or version on the public site. Record the release SHA, tests, owner, rights decision and rollback path in the existing coordination issue.
8. If the publication fails or causes a regression, stop new releases. Use a separate reviewed PR to restore the last known-good source (not a force push), and verify the recovery on the live site.

## Branch rule

The repository ruleset **"Unfire public gh-pages: PR and preflight"** targets only `gh-pages`. It requires a PR and successful `production-preflight`, and blocks branch deletion and force pushes. There are **zero mandatory human reviews** to avoid deadlocking a single-owner workflow; this is a technical gate, not a substitute for legal or owner approval.

The required `production-preflight` result must come from the **GitHub Actions** GitHub App (integration ID `15368`), not an arbitrary status emitter. Verify that the check originates from the approved app before treating a passing status as release evidence.

Never upload secrets, client correspondence, undisclosed contracts or private local evidence to this public repository. No payment checkout is authorised solely by passing automated tests.
