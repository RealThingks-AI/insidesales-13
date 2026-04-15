

## Deep Check: Campaign Module — Bugs & Improvements Found

### Bugs

**1. "Phone" vs "Call" communication_type inconsistency (HIGH)**
The DB has records with `communication_type = 'Phone'` (from older/external code) but the UI and analytics only filter for `'Call'`. These "Phone" records are invisible in the Outreach list (they show but don't match the channel filter), uncounted in Analytics (calls count), and don't trigger the correct stage rank logic.

**Fix**: In `CampaignAnalytics.tsx` line 99 and `CampaignCommunications.tsx` line 246, include both `"Call"` and `"Phone"` when filtering for call-type communications. Also update the channel filter dropdown to treat "Phone" as "Call", and the channel badge to handle "Phone".

**Files**: `CampaignAnalytics.tsx`, `CampaignCommunications.tsx`

---

**2. All manually logged communications have `delivery_status: 'pending'` (MEDIUM)**
When manually logging outreach (`handleLogCommunication`), line 141 sets `delivery_status` to `"manual"` only for Email type. For Call and LinkedIn, `delivery_status` is set to `null`. But the DB default is `'pending'`, so all non-email logs show "pending" delivery badges in the list view — misleading for Call/LinkedIn entries that don't have a "delivery" concept.

**Fix**: Set `delivery_status: null` explicitly for Call and LinkedIn in the insert (line 141). Also update the `deliveryBadge` function to return null for Call/LinkedIn types.

**File**: `CampaignCommunications.tsx`

---

**3. Region shows `[object Object]` for JSON array of objects (HIGH)**
`CampaignOverview.tsx` line 274: When region is stored as `[{"country":"Germany","region":"Europe",...}]`, the parser does `r.join(", ")` on objects, producing `[object Object]`.

**Fix**: Map array objects to readable strings: `r.map(item => typeof item === "object" ? [item.region, item.country].filter(Boolean).join(" — ") : String(item)).join(", ")`

**File**: `CampaignOverview.tsx`

---

**4. Edge function does NOT update contact stage after sending email (MEDIUM)**
When sending email via the compose modal → edge function, the communication is logged with `sent_via: "azure"`, but `campaign_contacts.stage` is never advanced to "Email Sent". The stage update logic only runs in `handleLogCommunication` (manual logging). Emails sent via the compose modal skip this entirely.

**Fix**: After `handleEmailSent` callback in `CampaignCommunications.tsx`, add contact stage update logic similar to manual logging. Or better: move stage update into the edge function itself so it always runs.

**File**: `CampaignCommunications.tsx` (add stage update in `handleEmailSent`) or `send-campaign-email/index.ts`

---

**5. Email compose toast uses `sonner` while rest of app uses `@/hooks/use-toast` (LOW)**
`EmailComposeModal.tsx` imports `toast` from `"sonner"` (line 13), but `CampaignCommunications.tsx` uses `toast` from `"@/hooks/use-toast"`. This causes inconsistent toast styling — some toasts appear in different positions/styles.

**Fix**: Standardize `EmailComposeModal.tsx` to use `@/hooks/use-toast`.

**File**: `EmailComposeModal.tsx`

---

**6. `delivery_status` default 'pending' causes incorrect email analytics (MEDIUM)**
Analytics line 95: `emailsSent` checks `delivery_status === "sent"`, but manually logged emails have `delivery_status: 'pending'` (DB default) even when `email_status` is "Sent". The `||` fallback catches this, but `emailsDelivered` only checks `email_status` — manually logged emails with status "Sent" but not "Delivered" are excluded from delivered count. This is technically correct but confusing when all manual logs show "pending" delivery.

**Fix**: For manually logged emails (`sent_via: 'manual'`), trust `email_status` field. For azure-sent emails, trust `delivery_status`.

**File**: `CampaignAnalytics.tsx`

---

### Improvements

**7. No "Reply" action on sent emails (LOW)**
Thread view shows emails but has no Reply button to compose a follow-up in the same thread. The `thread_id` and `parent_id` columns exist but are never populated.

**Not fixing now** — requires additional threading logic.

---

### Summary

| # | Fix | File |
|---|-----|------|
| 1 | Handle "Phone" as "Call" everywhere | `CampaignAnalytics.tsx`, `CampaignCommunications.tsx` |
| 2 | Fix delivery_status for non-email logs | `CampaignCommunications.tsx` |
| 3 | Fix region `[object Object]` display | `CampaignOverview.tsx` |
| 4 | Update contact stage after email send | `CampaignCommunications.tsx` |
| 5 | Standardize toast import | `EmailComposeModal.tsx` |
| 6 | Fix email analytics counting logic | `CampaignAnalytics.tsx` |

6 files modified, 0 migrations, 0 edge function changes.

