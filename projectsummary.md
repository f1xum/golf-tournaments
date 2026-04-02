Here's a full handoff summary for your new chat:

---

**THE PIN — Project Handoff Summary**
*Last updated: April 2026*

---

**What it is**
The Pin (thepin.app) is a German golf tournament discovery app. Aggregates all golf tournaments across Germany (20,233 tournaments, 843 clubs) via automated scrapers (PC CADDIE + BGV sources). Stored in Supabase, built with Next.js, deployed on Vercel.

**The opportunity**
- 642k registered golfers in Germany, no well-designed golfer-first discovery product exists
- PC CADDIE (main incumbent) is B2B club management software — 3.3 stars, golfer app is an afterthought
- Golf Post = social/media, no tournament aggregation
- Nexxchange = B2B club tool, not a competitor
- Strawberry Tour = DGV-adjacent tournament subscription circuit, events already in the database
- Zero direct competitors in DACH for tournament discovery

**Current state**
- Live at thepin.app and getthepin.com
- Auth: email/password + Google Sign-in
- User profiles: handicap, home club (selected from 843 clubs), username
- Personalized "Für dich" feed: tournaments filtered by HCP + distance from home club
- Saved tournaments with upcoming/past split
- Notification infrastructure: bell icon, unread count, Benachrichtigungen page, Erinnerung + Meldeschluss notification types
- Club pages: map, contact info, upcoming tournaments in list + calendar view
- Map view: all clubs with location pins, links to club pages
- Calendar/list toggle on tournament view
- Dark mode
- Calendar export (.ics)
- Loading progress animation bar
- Bottom navigation bar (mobile)
- Post-save popup directing to profile
- Performance optimized with caching

**Tech stack**
- Next.js 15 App Router
- Supabase (database + auth + RLS)
- Vercel (hosting)
- Leaflet/OpenStreetMap (maps)
- Two automated scrapers: PC CADDIE + BGV (currently paused to protect read-only relationship)

**Brand**
- Name: The Pin
- Domains: thepin.app (primary), getthepin.com (redirect/landing page later)
- Logo: in progress with Leonie (girlfriend, designer) — direction: location pin meets golf flag, black + forest green, Malbon Golf aesthetic
- Favicon: implemented
- Color: deep forest green (#1B4332 range)

**Strategic playbook**
1. Win golfers first with superior UX
2. Build notification-driven retention
3. Use golfer demand as leverage to approach clubs directly for data partnerships
4. Eventually B2B: clubs pay for direct integration, featured placement
5. Expand DACH → Europe when Germany is solid

**PC CADDIE moat:** Club relationships + legacy infrastructure. Brittle — clubs are locked in but not happy. Your angle: golfers outnumber clubs 642k to 730. Own the golfer relationship first.

**Monetization plan**
- Not charging yet — gate is: notifications working end-to-end + validation from users outside personal network
- Planned: free tier (browse, filter, map) + paid tier (notifications, personalized feed, social features) ~€9/month
- B2B clubs: later, ~€50-200/month

**Notification backlog (not yet built)**
- Cron/edge function for preference-based notifications (new tournaments matching user profile)
- Types to add: spots_filling_up (scarcity trigger, capacity data already exists), new_strawberry_tour (dedicated toggle)

**Current users**
- ~5-6 users from personal network
- Sent WhatsApp message to ~40 people in two Munich golf groups
- One signup from that round so far
- Feedback: "ganz geil gemacht", "sowas gab's nicht?" — positive surprise reactions

**Conversion insight**
- Most value visible without signup (browse, filter, map)
- Signup unlocks: personalized feed, saved tournaments, notifications
- Key conversion moment: user tries to save a tournament → prompt to register
- Don't hide more features — improve the moment of intent conversion instead

**Notion backlog (prioritized)**
- Tonight/this week: cron notification logic, save-to-register prompt improvement
- Short term: calendar invite reminders, map color coding (heimatclub, clubs with upcoming tournaments), better club cards
- Medium term: scraper rebuild for more club data, "request more regions" feature
- Later: iOS app (React Native on existing Supabase backend), App Store submission (€99 Apple Developer), getthepin.com landing page
- PWA explicitly ruled out — native iOS app only

**Key people**
- Leonie: girlfriend, doing logo design
- Noel Bollmann: YFood founder, validated the opportunity ("good market, outdated solution")
- Yannick: golf friend, early tester, suggested Golf Stammtisch group as next distribution channel

**Working style notes**
- Builds with Claude Code (Opus) in dedicated project chat
- Uses this chat (Sonnet) for strategy
- Ships to production directly for mobile testing — acceptable at this stage
- Captures ideas in Notion during the day, structures later
- Moves extremely fast — went from concept to full product in ~1 week

---

That's everything. Start the new chat, paste this in, and you're up to speed instantly. 🏌️