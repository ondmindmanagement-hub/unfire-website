# Corporate discovery · scoped SEO metadata

Date: 2026-11-05
Status: DRAFT / REVIEW ONLY. Not merged, not deployed, not a search ranking claim.
Coordination: #291 and #78.
Base: `main` `be39472fa3765846396f613f42a5196e74f600dd`.

## Search intent and exact page assignments

| Canonical URL | Primary query intent | Secondary topics | Change |
|---|---|---|---|
| https://unfire.technology/about/ | independent AI and creative technology studio | AI workflow oversight, audio software, interactive experiences | Title, description, Open Graph title/description |
| https://unfire.technology/enterprise/ | AI workflow oversight and technology licensing | remote feasibility pilots, integration, custom development | Title, description, Open Graph title/description; add existing canonical URL to sitemap |
| https://unfire.technology/apps/ | Unfire apps and development previews | human-reviewed AI workflows, Mac gesture control, audio tools | Title, description, Open Graph title/description |
| https://unfire.technology/ | Unfire company and technology portfolio | real portfolio and capabilities | **HOLD**: homepage owned by parallel release/integration work |
| https://unfire.technology/bolt/ | human-approved AI workflows for Mac | permissions, review before file edits | **UNCHANGED**: existing metadata matches intent; product owner to approve future copy |
| https://unfire.technology/archer/ | Archer audio clipping tool for Mac | music production, gain and threshold | **UNCHANGED**: no undocumented feature claims |
| https://unfire.technology/apps/unfire-control/ | Mac hand gesture and voice interaction preview | permission controls, development status | **UNCHANGED**: preserve explicit development-preview disclaimer |
| https://unfire.technology/pilot/ | written-first Bolt feasibility enquiries | scoped remote study, AI approvals | **UNCHANGED**: protect prototype caveats |

## Keyword discipline

- Use one distinct user intent per page, not repetition of the same phrase across titles.
- Titles, descriptions and visible product copy must truthfully match existing supported behavior.
- No `meta keywords` field; avoid keyword stuffing, misleading ranking or incorporation claims.
- Preserve English-only public copy, existing canonical URLs, robots directives, Open Graph and JSON-LD without synthetic availability assertions.
- Never advertise an unpublished feature as released, a paid pilot as accepted, or an unverified app status as approved.

## Review and release gates

1. Compare against exact base SHA. Scope must remain limited to metadata on the three named HTML files, one additional existing canonical entry in `sitemap.xml`, and this documentation.
2. Confirm exactly one title, description, Open Graph title/description and canonical link per edited page. Confirm exactly one `/enterprise/` URL in the sitemap, with no removal or changes to other URLs.
3. Check all three descriptions are plain English, readable, unique and between 100–175 characters; titles must not materially misrepresent the page.
4. Run existing relevant static/site checks, review final branch CI and review public-facing snippets.
5. Obtain site owner's integration approval. Do not merge or publish while GitHub Pages pipeline is errored; prove publication from live URL after repaired deployment.
6. If verified in the future, consider Search Console indexing/performance review, but do not claim rankings, impressions, clicks or indexing without direct data.
