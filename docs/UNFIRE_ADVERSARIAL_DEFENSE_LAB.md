# Unfire · Adversarial Defense Lab

**Status:** bounded synthetic safety checks. Not an unrestricted agent collective and not a penetration test.

## Goal

Discover defects before release by alternating four explicitly scoped review roles:

1. **Scout:** inspect first-party code and the existing issue/CI baseline. Collect evidence without touching live systems.
2. **Challenger:** propose counterexamples using synthetic local input only, including spoofed game-frame messages and placeholder secret-file scenarios.
3. **Defender:** assess whether existing protections reject those counterexamples. Fix narrowly in a product owner's own branch when needed.
4. **Independent verifier:** demand a negative and positive control, rerun the established CI, examine false positives, and block a release on meaningful failures.

These roles represent a reproducible method. Installing these tests does **not** launch external agents, grant privileges, or permit model collaboration beyond approved tasks.

## Implemented baseline

- Existing game-host security: `tests/audio-message-boundary.test.cjs` checks the guard before command handling. New `tests/unfire-adversarial-boundaries.test.cjs` challenges the **actual extracted source/origin predicate** with seven synthetic scenarios. It executes only the isolated predicate, not application actions.
- Existing credential scanner: `scripts/check-public-security.py` remains unchanged. New `tests/test_unfire_adversarial_secrets.py` checks sensitive filenames, safe templates, a harmless synthetic marker, suppression of marker contents in logs, and a clean fixture.
- The existing `unfire-public-security.yml` pull-request gate runs these checks after the current security scanner and game-host guard. No scheduled jobs or third-party dependencies are added.

## Authorization and containment

- **Allowed:** own-repository read-only review, local mocked inputs, scoped test changes, recorded findings, independently reviewed pull requests.
- **Not allowed:** penetration tests or account probing of Hugging Face, Apple, OpenAI or other third parties; destructive or stealth testing; guessing credentials; bypassing access controls; writes to production, customer accounts, DNS, payments, App Store submissions or active game sessions.
- Do not fetch private user data for test inputs. Never publish real credentials, private reports, personal identifiers or internal device paths to a public issue.
- No new recurring monitor: reuse the existing Unfire security surveillance and quality reviews.
- Preserve the existing one-owner-per-file, freeze, CI, and release-integrator rules in issue #78. Game owner is #13, host bridge boundary #69, legal provenance #140 and Apple release gate #215.

## Evidence and limitations

The synthetic tests detect regressions in two narrow boundaries, not all vulnerabilities. A passing result is **not** proof of overall software security, rights clearance, App Store review readiness, or physical iPhone/iPad compatibility. Keep all release claims evidence-backed.

If any negative control starts passing through a trust boundary, stop integration; open a narrowly scoped fix with the owner and test the actual combined commit. Never make security bypasses in production to demonstrate a problem.
