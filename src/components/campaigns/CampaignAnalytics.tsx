import { useCampaignAccounts, useCampaignContacts, useCampaignCommunications } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Mail, Phone, Linkedin, BarChart3 } from 'lucide-react';

interface Props {
  campaignId: string;
}

export function CampaignAnalytics({ campaignId }: Props) {
  const accounts = useCampaignAccounts(campaignId);
  const contacts = useCampaignContacts(campaignId);
  const comms = useCampaignCommunications(campaignId);

  const accountsData = accounts.query.data || [];
  const contactsData = contacts.query.data || [];
  const commsData = comms.query.data || [];

  const emailsSent = commsData.filter(c => c.communication_type === 'Email').length;
  const callsMade = commsData.filter(c => c.communication_type === 'Phone').length;
  const linkedinSent = commsData.filter(c => c.communication_type === 'LinkedIn').length;
  const responded = contactsData.filter(c => c.stage === 'Responded' || c.stage === 'Qualified').length;
  const dealsCreated = accountsData.filter(a => a.status === 'Deal Created').length;

  const stats = [
    { label: 'Accounts Targeted', value: accountsData.length, icon: Building2 },
    { label: 'Contacts Targeted', value: contactsData.length, icon: Users },
    { label: 'Emails Sent', value: emailsSent, icon: Mail },
    { label: 'Calls Made', value: callsMade, icon: Phone },
    { label: 'LinkedIn Messages', value: linkedinSent, icon: Linkedin },
    { label: 'Responses', value: responded, icon: BarChart3 },
  ];

  const responseRate = contactsData.length > 0 ? ((responded / contactsData.length) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Funnel Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Response Rate</span>
            <span className="font-medium text-foreground">{responseRate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deals Created</span>
            <span className="font-medium text-foreground">{dealsCreated}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Communications</span>
            <span className="font-medium text-foreground">{commsData.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
