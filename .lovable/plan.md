

# Campaign Module Implementation Plan

## Scope Assessment

This is a full CRM module with 10+ database tables, multiple page views, integrations with Accounts/Contacts/Deals/Action Items, email tracking, file storage, and analytics. This is too large for a single implementation pass. I recommend a phased approach.

## Phase 1 — Core Campaign CRUD (Start Here)

### Database Tables

**1. `campaigns` table**
- `id` uuid PK
- `campaign_name` text NOT NULL
- `description` text
- `campaign_type` text (e.g., 'Email', 'LinkedIn', 'Phone', 'Multi-Channel')
- `status` text DEFAULT 'Draft' ('Draft', 'Active', 'Paused', 'Completed', 'Cancelled')
- `owner` uuid (references auth.users)
- `start_date` date
- `end_date` date
- `region` text
- `country` text
- `target_audience` text (e.g., 'CEO', 'Manager', 'Technical')
- `message_strategy` text
- `created_by` uuid NOT NULL
- `modified_by` uuid
- `created_at` timestamptz DEFAULT now()
- `modified_at` timestamptz DEFAULT now()

RLS: authenticated SELECT all, INSERT/UPDATE/DELETE by creator or admin.

**2. `campaign_accounts` table** (junction: campaigns ↔ accounts)
- `id` uuid PK
- `campaign_id` uuid NOT NULL → campaigns.id ON DELETE CASCADE
- `account_id` uuid NOT NULL → accounts.id ON DELETE CASCADE
- `status` text DEFAULT 'Not Contacted' ('Not Contacted', 'Contacted', 'Responded', 'Deal Created')
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()
- UNIQUE(campaign_id, account_id)

**3. `campaign_contacts` table** (junction: campaigns ↔ contacts)
- `id` uuid PK
- `campaign_id` uuid NOT NULL → campaigns.id ON DELETE CASCADE
- `contact_id` uuid NOT NULL → contacts.id ON DELETE CASCADE
- `account_id` uuid (optional link to parent account)
- `stage` text DEFAULT 'Not Contacted' ('Not Contacted', 'Email Sent', 'Phone Contacted', 'LinkedIn Contacted', 'Responded', 'Qualified')
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()
- UNIQUE(campaign_id, contact_id)

**4. `campaign_communications` table** (tracks all outreach)
- `id` uuid PK
- `campaign_id` uuid NOT NULL → campaigns.id ON DELETE CASCADE
- `contact_id` uuid → contacts.id
- `account_id` uuid → accounts.id
- `communication_type` text NOT NULL ('Email', 'Phone', 'LinkedIn', 'Meeting', 'Follow Up')
- `subject` text
- `body` text
- `email_type` text ('Initial Outreach', 'Follow Up 1', 'Follow Up 2', 'Final Follow Up')
- `email_status` text ('Sent', 'Opened', 'Replied')
- `linkedin_status` text
- `call_outcome` text ('Interested', 'Not Interested', 'Call Later', 'Wrong Contact')
- `notes` text
- `outcome` text
- `owner` uuid
- `communication_date` timestamptz DEFAULT now()
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()

**5. `campaign_materials` table** (marketing assets)
- `id` uuid PK
- `campaign_id` uuid NOT NULL → campaigns.id ON DELETE CASCADE
- `file_name` text NOT NULL
- `file_path` text NOT NULL
- `file_type` text ('One Pager', 'Product Overview', 'Case Study', 'Presentation', 'Brochure', 'Technical Document')
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()

**6. `campaign_email_templates` table**
- `id` uuid PK
- `campaign_id` uuid → campaigns.id ON DELETE CASCADE
- `template_name` text NOT NULL
- `subject` text
- `body` text
- `email_type` text ('Initial Outreach', 'Follow Up 1', 'Follow Up 2', 'Final Follow Up')
- `audience_segment` text
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()

**7. `campaign_phone_scripts` table**
- `id` uuid PK
- `campaign_id` uuid → campaigns.id ON DELETE CASCADE
- `script_name` text
- `opening_script` text
- `key_talking_points` text
- `discovery_questions` text
- `objection_handling` text
- `audience_segment` text
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()

**Storage:** Create a `campaign-materials` storage bucket for file uploads.

### Frontend — New Files

| File | Purpose |
|------|---------|
| `src/pages/Campaigns.tsx` | Main campaigns page (list + detail) |
| `src/types/campaign.ts` | TypeScript types for all campaign entities |
| `src/components/campaigns/CampaignList.tsx` | Campaign list table with filters |
| `src/components/campaigns/CampaignModal.tsx` | Create/Edit campaign form |
| `src/components/campaigns/CampaignDetailPanel.tsx` | Expanded campaign detail view |
| `src/components/campaigns/CampaignAccountsTab.tsx` | Target accounts management |
| `src/components/campaigns/CampaignContactsTab.tsx` | Target contacts management |
| `src/components/campaigns/CampaignOutreachTab.tsx` | Communication tracking |
| `src/components/campaigns/CampaignMaterialsTab.tsx` | Marketing materials upload |
| `src/components/campaigns/CampaignAnalytics.tsx` | Performance metrics |
| `src/components/campaigns/ConvertToDealDialog.tsx` | Convert contact response to Deal (Lead stage) |
| `src/hooks/useCampaigns.tsx` | Campaign CRUD hooks |

### Sidebar & Routing Changes

**`src/components/AppSidebar.tsx`** — Add Campaigns entry between Deals and Action Items:
```
{ title: "Campaigns", url: "/campaigns", icon: Megaphone }
```

**`src/App.tsx`** — Add `/campaigns` route with lazy-loaded page, add to `controlledScrollRoutes`.

### Campaign List Page Layout

- Top bar: title, search, filters (status, type, owner, date range), "+ New Campaign" button
- Table columns: Campaign Name, Owner, Type, Start Date, End Date, Status, Accounts, Contacts, Deals Created
- Click row → expand detail panel (similar to Deals expanded panel pattern)

### Campaign Detail Panel

Tabbed layout within the expanded panel:
1. **Overview** — Campaign info, strategy fields, timing
2. **Accounts** — Target accounts list with status, bulk add, filters
3. **Contacts** — Contacts within targeted accounts, stage tracking
4. **Outreach** — Communication log (email, phone, LinkedIn), templates, scripts
5. **Materials** — Upload/attach marketing documents
6. **Analytics** — Funnel metrics, response rates, deals generated

### Deal Conversion Flow

"Convert to Deal" button on qualified campaign contacts:
- Pre-fills Deal with: deal_name, account (from campaign_account), contact, region
- Sets stage to "Lead"
- Stores campaign attribution (can add `campaign_id` column to deals table)
- Updates campaign_contact stage to "Qualified" and campaign_account status to "Deal Created"

### Settings Integration

Add "Campaigns" sub-tab under Admin Settings:
- Campaign Types configuration
- Default follow-up rules
- Call outcome options
- LinkedIn status options

## Phase 2 (Future)

- Email sending integration (actual send via edge function)
- LinkedIn API integration
- Automated follow-up scheduling via cron jobs
- Campaign cloning/templates
- Advanced analytics with Recharts visualizations

## Implementation Order

1. Database migration (all 7 tables + storage bucket + RLS)
2. Types file (`src/types/campaign.ts`)
3. Hooks (`src/hooks/useCampaigns.tsx`)
4. Sidebar + routing updates
5. Campaign list page
6. Campaign create/edit modal
7. Campaign detail panel with all tabs
8. Convert to Deal dialog
9. Settings integration
10. Campaign analytics

This is approximately 2000-3000 lines of new code across 12+ files. Implementation will proceed step by step after approval.

