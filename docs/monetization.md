# Monetization & Growth

## Phase 3 launch order

1. **Tipping** (lowest regulatory friction; immediate creator delight).
2. **Creator subscriptions** (Patreon-style monthly).
3. **Brand-safe ads** in feed (auction, audience controls, opt-out for paying users).
4. **Marketplace fees** (digital goods first, physical later).
5. **Verified / premium** subscription (priority support, larger uploads, AI quotas).

## Take rates

| Surface               | Take | Creator share |
|-----------------------|------|---------------|
| Creator subscriptions | 5%   | 95%           |
| Tips                  | 10%  | 90%           |
| Marketplace           | 15%  | 85%           |
| Ads                   | 30% gross → ~55% creator share (matches YouTube benchmark) |

## Ledger

- **Double-entry from day one** of any money movement.
- `journal_entries` are immutable; corrections are reversing entries.
- Idempotency keys on every external call (Stripe / Razorpay).
- Daily reconciliation job vs PSP statements; discrepancies page on-call.

## Payment providers

- **Stripe Connect** for global / EU / US.
- **Razorpay Route** for India.
- PSP routing chosen per creator's payout country at onboarding.

## Compliance

- KYC / KYB at payout enrollment (Persona / Stripe Identity).
- 1099 / equivalent tax reporting via PSP exports.
- GST handling for India creators.

# Growth

## Wedge

Launch as: **creator-friendly short-form video + integrated DMs, India-first**. Not "everything for everyone."

## Loops

- **Invite contacts** (explicit consent only — never silently scrape address books).
- **Share-to-external** with deep links and OG previews.
- **Creator referral revenue boost** for the first 90 days.

## Cold start

- Seed with **~1k local creators** in 3 cities; pay for exclusive content.
- **Import-from-other-platform** tool, **user-initiated** only (legally compliant, GDPR/DPDP-safe).

## Retention

- Day-1 onboarding: follow ≥5 creators tailored to interests.
- **Smart notification budget**: ≤3 push notifications per day by default; user-configurable.
- Weekly digest email/notification.

## Anti-addiction as a feature

- Visible **screen-time dashboard**.
- Configurable **feed cap** ("show me 30 reels then stop").
- **Take-a-break nudges** based on session length.
- This is a marketed differentiator, not a hidden setting.
