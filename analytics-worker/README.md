# Unfire Audio privacy-conscious play metrics

Records only daily **consented tab sessions** viewing `/audio/` (`visit`) and entering immersive gameplay (`play`). These are not unique people. No IP addresses, names, device fingerprinting or persistent cross-session IDs are stored. A tab-session random UUID is generated; it is never written to a cookie. No events are sent if analytics consent is not accepted.

## Deployment dependency (not yet connected)

Create a free Cloudflare Worker and D1 database, bind the D1 database as `DB`, and run `schema.sql` against it. Deploy `src/index.js` with the route `/event` (e.g. `https://<worker>.workers.dev/event`). Then add this meta tag on `/audio/index.html` **before** `js/play-metrics.js`:

`<meta name="unfire-analytics-endpoint" content="https://<worker>.workers.dev/event">`

Never put API tokens on the web page. Set `Access-Control-Allow-Origin` for the live canonical domain. Consent behavior depends on the website's cookie acceptance UI: review the privacy notice before enabling. To view totals run this D1 SQL (authenticated from the Cloudflare dashboard):

`SELECT day, SUM(CASE WHEN event='visit' THEN total ELSE 0 END) visits, SUM(CASE WHEN event='play' THEN total ELSE 0 END) play_sessions FROM daily GROUP BY day ORDER BY day DESC;`

Purging `seen` rows after 2 days is recommended; counts in `daily` survive. Validating Origin helps browser access but is not authentication or bot protection; treat counts as estimates, exclude QA sessions, and use provider rate limits. No retroactive data is available.
