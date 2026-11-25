# Global Challenges — product experience & launch UX (DRAFT)

**For the owner of PR #342, not a second website or deployed feature.** English-only, fully asynchronous by writing, accessible on mobile. No fake logos, jurors, sponsors, awards, entry forms or statistics.

## Information architecture

One umbrella navigation label: **Challenges**. Preserve `/challenge/` as the existing canonical route. Proposed future categories are filterable views **within** that route, not twelve cloned microsites. Separate company awards/recognition from awards given to entrants. Each edition has the immutable public code `UGC-001`, `UGC-002` etc.

**Prelaunch hero copy:** “Unfire Global Challenges — practical problems, independent thinking, verifiable results.” Subline: “Exploring free, written-only innovation challenges. Every future edition will have its own official rules, eligibility and verified awards. No competitions are open yet.” CTA: “Ask about future editions” -> known written contact (email; privacy notice required). Do not label it “Apply” or “Enter”.

**Top-level page sequence:**
1. Hero with concise, accurate availability notice; keyboard-focusable next section.
2. “How it would work”: Explore -> Read rules -> Submit in writing -> Independent review -> Results/awards (all hypothetical while prelaunch).
3. Categories as scalable, readable cards with icon + objective + preliminary state (CONCEPT or PLANNED).
4. Proposed pilot deep links for AI Reliability & Human Control and Audio & Voice Quality; links remain informational, not entry endpoints.
5. Participant value: skill assessment, optional showcase with permission, potential donated prizes only when confirmed. Never promise cash, job opportunities, investor meetings or individual critiques beyond available capacity.
6. Safeguards: fairness, rights retained, no data sale, no calls/travel, independently judged, complaints channel.
7. Proposed partner/jury interest by email; clearly nonbinding, no sponsor logos without permission.
8. Footer: real organizer/legal identification and privacy links once reviewed; historic edition archive only for real events.

## Cards / status language

- **CONCEPT**: “In research — not accepting entries”. No countdown, dates, “register”, prize tag or application widget.
- **PLANNED**: “Proposed edition — final rules pending”. No registration until approvals pass.
- **OPEN**, **JUDGING**, **RESULTS**: disallowed in the draft catalog; a future audited backend/release must own those transitions and display versioned evidence.
- **CANCELLED** and **ARCHIVED**: preserved truthfully in a separate historic record when real, not removed or repurposed.
- “Worldwide” in SEO means accessible information; never claim eligibility in every jurisdiction.

## Visual system — premium restraint rather than fake extravagance

- Dark neutral foundation, one restrained electric-blue accent; high-contrast typography, large but uncluttered headings, consistent focus states. Avoid generic AI stock photos, simulated conferences or speculative badges.
- 8-point spacing scale, responsive 320px–1440px layouts, minimum 44x44px tap targets where practical, accurate contrast meeting WCAG 2.2 AA, no mandatory animations or horizontal scrolling.
- Keep text short; each challenge answers **why this matters, what to submit, who can enter, how judged, what is awarded and exact verified dates**.
- On small screens use a single-column list with functional filters and semantic headings. On desktops a 2–3 column layout is acceptable but must not bury legal/eligibility information.
- Avoid huge video, autoplay, animated WebGL, tracking pixels, third-party fonts and dependencies unless justified; respect `prefers-reduced-motion`, data budgets, and offline errors.
- Static Pages may publish information-only materials but not store entrants, run payments or impersonate a secure submission service. Review GitHub Pages business/SaaS limits before any integration.

## Event intake — future secure behavior (not implemented here)

- Email-first or approved external intake, completely asynchronous. Explicit opt-in for name publicity/portfolio links separate from entry; no default marketing consent.
- Date/UTC acceptance, immutable edition ID and terms version, idempotent reference number, human acknowledgement, withdrawal mechanism, anti-spam/rate limits, basic incident response and no password or sensitive-data collection.
- Written Q&A handled consistently with published answers for all entrants if doing so does not reveal private details. Same deadlines for all, no privileged side channel for sponsors.
- Judge review separated by role; conflicts and independence recorded. Lock rubric before first entry and prevent mutation after launch.
- Results released only after independent adjudication and permission; do not show winner names, country or employer without appropriate consent.
- This repository must **not** contain participant data, identity documents, payment records, judges' private contact information or internal sponsor negotiations.

## Release QA / stop criteria

Keyboard tab order, visible focus, screen reader semantics, skip link, reduced motion, high contrast, 320/375/390/768/1280 viewport screenshots, real Safari on Apple + Android browser, links, language, privacy & accessibility docs, zero misleading claim, no accidental calls/registration, CI on exact head SHA, one integrator and verified public HTTPS after an approved merge.

**DRAFT ONLY. Existing PR #342 is the sole designated web integration path.**
