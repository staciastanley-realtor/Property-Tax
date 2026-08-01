# Michigan Property Tax Intelligence — Version 2 (Phase 1)

A separate project from the live V1 calculator — **V1 is completely
untouched**. Deploy this as its own Vercel project on a staging
domain/subdomain, not over the live one.

Built against a supplied premium-dashboard mockup, but reshaped around
what's actually real: **no fabricated data, no fake trust stats, no
other companies' logos.** See "What's different from the mockup, and
why" below before you show this to anyone.

## What's new in V2 vs. V1

- Full dashboard layout: property summary, PRE-vs-non-homestead
  comparison, millage breakdown, 5-year projection, confidence
  indicator, local expert card, helpful tools, report sharing
  (print/PDF, copy link, email), and a statewide referral form on
  every report.
- Zero new npm dependencies — the donut and bar charts are hand-rolled
  SVG (`app/components/MillageDonut.tsx`,
  `app/components/ProjectionChart.tsx`), specifically to avoid adding
  new packages that could break the build the way earlier ones did.
- `lib/confidence.ts` — a real confidence indicator built from actual
  match-quality signals (geocode success, jurisdiction match status,
  whether you manually confirmed it) — not a fabricated percentage.
- `lib/projection.ts` — 5-year projection using Michigan's real
  Proposal A statutory cap (5%/year max taxable-value growth),
  clearly labeled as a worst-case-style estimate, not a prediction.
- `lib/my-listings.ts` + `data/my-listings.json` — a manually-maintained
  list of your active listings. **You need to update this yourself**
  when you get a new listing or one sells — add/remove entries in
  `data/my-listings.json`. This sidesteps the IDX licensing question
  entirely since it's just a link to a page you already control, not
  live MLS data displayed inside this app.
- `app/api/referral/route.ts` — the statewide referral form's backend.
  **Read the warning in that file** — it only actually saves
  submissions if `DATABASE_URL` is set. Without it, the form still
  shows buyers a success message (a broken-looking form helps no one),
  but nothing is persisted. Don't point real traffic at this until
  you've got a database connected — same `DATABASE_URL` pattern as
  the GIS adapter, see the original README's Milestone 2 section.
- `db/schema.sql` — extended with `referral_leads` and `partner_agents`
  tables, matching your full spec (lead status, searched property,
  purchase price, estimated taxes, requested market, assigned partner,
  contact date, agreement status, transaction stage, expected/paid
  referral fee). Manual assignment only — `counties_served` on
  `partner_agents` is there so automatic assignment-by-county can be
  added later without a schema change, per your request.

## What's different from the mockup, and why

The supplied mockup showed several things this build deliberately
**doesn't** include, because they'd require data or claims this app
doesn't actually have:

| Mockup showed | This build does instead | Why |
|---|---|---|
| Current owner's actual tax bill, assessed value | Skipped — instead compares Principal Residence vs. Non-Homestead scenarios for the buyer | Requires real parcel/assessor data (SEV, current taxable value) — a different data source than the statewide millage rates this app has. Needs a paid parcel-data API or per-county integration; not something to fake. |
| MLS listing card (photos, beds/baths, price, "Active") | A link to your own KW.com listing page, only when the address matches your manually-maintained list | Real MLS data requires a signed IDX Data Access Agreement through your broker — not in place yet. Linking to your own site needs no license at all. |
| Sale history | Omitted entirely | Same as current-owner data — needs parcel/county register-of-deeds data this app doesn't have. |
| "128 Partner Agents / 83 Counties / $156M+ Referral Volume" stats | Omitted | You have zero partner agents signed up yet. Publishing fabricated numbers is a real liability, not a placeholder issue. |
| Vendor logo row (KW, CMG, TitleOne, etc.) | Omitted | Displaying other companies' logos implies a partnership/endorsement that doesn't exist. Trademark issue, not a design choice. |
| Generic "98%" confidence score | A real confidence label built from actual match signals | A fabricated-looking precise number is worse than an honest qualitative one. |
| "Where Your Taxes Go" 5-category pie | An honest 2-category split: State Education Tax (a real, fixed 6-mill statewide rate) vs. everything else grouped together | The millage report only gives a combined total rate — no category-by-category breakdown by taxing authority exists in the source data. |

None of this is permanent — the current-owner data, MLS card, and sale
history are all things you could genuinely add later if you get access
to a parcel-data API and your IDX agreement goes through. This build
just doesn't pretend to have them now.

## Referral fee tracking — one more reminder

The schema and dashboard spec track real money (`expected_referral_fee`,
`paid_referral_fee`). As flagged before: referral fees between real
estate licensees are regulated in Michigan and generally have to flow
through licensed brokers with a proper written agreement. Worth
confirming with your broker before this becomes a live system tracking
actual fee obligations, not just a schema.

## Deploying this as a separate staging site

Same process as V1, but as its own project:

```bash
npm install
npm run dev        # to preview locally first
```

Then, from this folder specifically (not the V1 folder):
```bash
npx vercel --prod
```
When it asks which project, choose **"Create a new project"** — don't
link it to your existing `mi-property-tax-estimator` project, or you'll
overwrite the live V1 site. Give it its own name (e.g.
`mi-tax-estimator-v2` or `stacia-tax-dashboard`), and it'll get its own
`.vercel.app` URL, completely separate from V1.

## Not built yet (Phase 2)

The **private, authenticated owner dashboard** for managing referral
leads (viewing submissions, assigning partner agents, tracking
agreement/transaction status and fees) is not part of this pass — you
said owner-only access is fine, which simplifies the auth approach, but
it's still a distinct piece of work: an authentication system, an admin
UI for the `referral_leads`/`partner_agents` tables, and (once
`DATABASE_URL` is actually connected) the real data flowing into it.
Let me know when you want to start that.

---

## Phase 2 — Owner Dashboard (auth, referrals, blog, analytics)

All built now, in one pass, since the referral dashboard, blog editor,
and analytics all needed the same thing: a login only you can use.

### Setting it up

1. **Run the schema** — this is the full file including everything
   from earlier passes (millage tables, referral tables, and now blog/
   analytics tables). If this is your first time running
   `npm run db:migrate` on this database, run it once, straight
   through. **Don't run it a second time on a database that already
   has these tables** — `CREATE TABLE`/`CREATE TYPE` will fail on
   anything that already exists (this file isn't written as
   incremental migrations). If you need to add more tables later,
   that'll be a new small SQL snippet, not a full re-run.
   ```bash
   npm run db:migrate
   ```
2. **Set two new environment variables** in Vercel (Settings →
   Environment Variables), same as `MAPBOX_ACCESS_TOKEN` before:
   - `OWNER_PASSWORD` — whatever you want to log in with
   - `SESSION_SECRET` — any long random string; generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
3. **Redeploy** (`npx vercel --prod`)
4. Go to `yoursite.vercel.app/admin/login` and sign in

### What's in the dashboard

- **`/admin/referrals`** — every submission from the "Find a Local
  Partner" form, expandable to edit status, assign a partner agent,
  log contact date, agreement status, transaction stage, and expected/
  paid referral fee. Partner agents themselves aren't manageable from
  the UI yet — add them via `POST /api/admin/partner-agents` for now
  (a simple "add agent" form is a quick follow-up whenever you want it).
- **`/admin/blog`** — write, save as draft, and publish posts.
  Markdown supported (headers, bold, italic, links, lists) via a
  small hand-rolled renderer (`lib/markdown.ts`) — deliberately not a
  new npm dependency, given how fragile new packages have been for
  this project's build. Published posts show up at `/blog` publicly.
- **`/admin/analytics`** — total searches, average purchase price
  searched, return visitor count, search→referral conversion rate,
  top counties searched, and the Realtor/Lender/Homebuyer breakdown
  from the first-visit popup.

### The first-visit popup

Shows once per browser (tracked via `localStorage`, not a cookie —
so it won't nag people who already answered, and "Skip" counts as
answered too, just with no type recorded). Answering is completely
optional and never blocks using the calculator.

### Privacy note — read before turning on analytics for real traffic

This tracks return visits via a cookie and, if answered, a
self-reported Realtor/Lender/Homebuyer type. No name, email, or IP is
stored in the analytics tables — `visitors` only has a random cookie
ID. Even so, once this is live with real traffic, add a short privacy
notice to the site (a few sentences on cookie use is standard and
sufficient for what this collects — doesn't need to be a big legal
document, but shouldn't be skipped either).

### Security notes on this auth system

This is intentionally minimal — one shared password, not a full
user-accounts system, because you're the only person who needs access
(your own answer earlier in this project). If that ever changes
(partner agents needing their own logins, for instance), this would
need to become real per-user accounts with hashed passwords in the
database — a bigger change, not a small addition. Flagging that now so
it's not a surprise later if the "who needs access" answer changes.

---

## Update: lender-introduction checkbox

Added `wants_lender_intro` to the referral form and dashboard — buyers
can now opt in to an introduction to your trusted lender alongside the
realtor referral. Unpaid courtesy introduction only (as discussed) —
if that lender relationship ever becomes a paid arrangement, that
needs RESPA-compliant structuring (a Marketing Services Agreement or a
disclosed Affiliated Business Arrangement), not this checkbox.

**If you already ran `npm run db:migrate` once** (for the earlier
Phase 2 tables), running the full schema again will fail on
already-existing tables. Just add the one new column instead:

```sql
ALTER TABLE referral_leads ADD COLUMN wants_lender_intro BOOLEAN NOT NULL DEFAULT false;
```

Run that directly against your database (e.g. via `psql "$DATABASE_URL" -c "..."` 
or any Postgres client) instead of re-running `db:migrate`.

**If you haven't migrated yet at all**, no action needed — `npm run
db:migrate` already includes this column in the full schema.
