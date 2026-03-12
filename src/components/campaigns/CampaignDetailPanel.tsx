import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CampaignAccountsTab } from './CampaignAccountsTab';
import { CampaignContactsTab } from './CampaignContactsTab';
import { CampaignOutreachTab } from './CampaignOutreachTab';
import { CampaignMaterialsTab } from './CampaignMaterialsTab';
import { CampaignAnalytics } from './CampaignAnalytics';
import type { Campaign } from '@/types/campaign';
import { format } from 'date-fns';

interface Props {
  campaign: Campaign;
  onClose: () => void;
  onEdit: () => void;
}

export function CampaignDetailPanel({ campaign, onClose, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-foreground truncate">{campaign.campaign_name}</h2>
          <Badge variant="outline" className="shrink-0">{campaign.status}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="px-4 pt-2 justify-start shrink-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-auto">
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="font-medium">{campaign.campaign_type || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target Audience</span>
                <p className="font-medium">{campaign.target_audience || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Start Date</span>
                <p className="font-medium">{campaign.start_date ? format(new Date(campaign.start_date), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">End Date</span>
                <p className="font-medium">{campaign.end_date ? format(new Date(campaign.end_date), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Region</span>
                <p className="font-medium">{campaign.region || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Country</span>
                <p className="font-medium">{campaign.country || '—'}</p>
              </div>
            </div>
            {campaign.description && (
              <div>
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm mt-1">{campaign.description}</p>
              </div>
            )}
            {campaign.message_strategy && (
              <div>
                <span className="text-sm text-muted-foreground">Message Strategy</span>
                <p className="text-sm mt-1">{campaign.message_strategy}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="accounts" className="mt-0">
            <CampaignAccountsTab campaignId={campaign.id} />
          </TabsContent>

          <TabsContent value="contacts" className="mt-0">
            <CampaignContactsTab campaignId={campaign.id} />
          </TabsContent>

          <TabsContent value="outreach" className="mt-0">
            <CampaignOutreachTab campaignId={campaign.id} />
          </TabsContent>

          <TabsContent value="materials" className="mt-0">
            <CampaignMaterialsTab campaignId={campaign.id} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <CampaignAnalytics campaignId={campaign.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
