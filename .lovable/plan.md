
Goal: make campaign emails use the same working email path the project already relies on, and stop showing “sent” when nothing was actually delivered.

What I found
- Campaign email sending is isolated in `supabase/functions/send-campaign-email/index.ts` and is hardcoded to Microsoft Graph/Azure.
- The campaign compose UI calls only that function from `src/components/campaigns/EmailComposeModal.tsx`.
- Manual outreach logging in `src/components/campaigns/CampaignCommunications.tsx` writes directly to `campaign_communications` with `sent_via = "manual"` and can still show statuses like “Sent”, which is misleading.
- Existing reminder emails in `supabase/functions/daily-action-reminders/index.ts` also use Microsoft Graph, so the “existing configured email service” in code is Microsoft Graph.
- However, there is currently no configured project email domain and no runtime secrets available, so there is no active sender configuration available to reuse right now.
- The Email Center UI reads from `email_history`, but campaign sends only insert minimal rows there and do not integrate with the richer delivery fields the UI expects.

Implementation plan
1. Unify campaign sending with the existing sender utility
- Extract the Microsoft Graph token/send logic into a shared helper under `supabase/functions/_shared/` so both `daily-action-reminders` and `send-campaign-email` use the same code path.
- Make `send-campaign-email` use that shared helper instead of maintaining separate Azure-specific logic.

2. Harden send result handling
- Treat only a real provider success response as sent.
- Return structured failure reasons from the function.
- Write richer failure details into `campaign_communications` and `email_history` so the UI can show what happened.

3. Fix misleading campaign UI states
- In `EmailComposeModal`, surface provider errors clearly instead of generic “Unknown error”.
- In `CampaignCommunications`, visually separate:
  - Sent via provider
  - Logged manually
  - Failed delivery
- Update badges/text so manual entries are never counted or displayed as actual delivered emails.

4. Fix campaign analytics logic
- Update `src/components/campaigns/CampaignAnalytics.tsx` so manual logs are not counted as delivered/sent email performance.
- Base email metrics on `delivery_status` and provider-backed records, not optimistic/manual statuses.

5. Align Email Center visibility
- Improve `email_history` writes from campaign sends so they match the Email Center’s expectations more closely.
- Ensure failed campaign sends appear as failures and successful sends can be distinguished from true delivered/opened/replied states.

6. Sender configuration follow-up
- Since no runtime secrets are currently configured, I’ll keep the code wired to the existing Microsoft Graph path and make it fail clearly until the current sender credentials are present.
- If you want, after approval I can also add a small admin-side status indicator that tells you whether campaign email sending is currently configured.

Files likely to change
- `supabase/functions/send-campaign-email/index.ts`
- `supabase/functions/daily-action-reminders/index.ts`
- `src/components/campaigns/EmailComposeModal.tsx`
- `src/components/campaigns/CampaignCommunications.tsx`
- `src/components/campaigns/CampaignAnalytics.tsx`
- possibly a new shared helper under `supabase/functions/_shared/`

Technical notes
- The current issue is not just delivery; it is also state integrity. The app can record “sent” in campaign views even when an email was only logged manually or the provider path is not configured.
- There is no Lovable email domain configured for this project and no runtime secrets currently present, so there is nothing active to switch over to automatically right now.
- Best path is to consolidate around the already implemented Microsoft Graph sender logic, remove misleading UI assumptions, and make configuration errors explicit.
