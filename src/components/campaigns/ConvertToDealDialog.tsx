import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { CampaignContact } from '@/types/campaign';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignContact: CampaignContact | null;
}

export function ConvertToDealDialog({ open, onOpenChange, campaignId, campaignContact }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dealName, setDealName] = useState('');
  const [loading, setLoading] = useState(false);

  const contactName = campaignContact?.contacts?.contact_name || '';

  const handleConvert = async () => {
    if (!user || !campaignContact) return;
    setLoading(true);
    try {
      const name = dealName.trim() || `Campaign Lead - ${contactName}`;
      const { error } = await supabase.from('deals').insert({
        deal_name: name,
        stage: 'Lead',
        lead_name: contactName,
        created_by: user.id,
        campaign_id: campaignId,
      } as any);
      if (error) throw error;

      // Update campaign contact stage
      await supabase.from('campaign_contacts').update({ stage: 'Qualified' } as any).eq('id', campaignContact.id);

      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: 'Deal created', description: `"${name}" added to Lead stage` });
      onOpenChange(false);
      setDealName('');
    } catch (err: any) {
      toast({ title: 'Error creating deal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            Create a new Deal at <strong>Lead</strong> stage from campaign contact <strong>{contactName}</strong>.
          </p>
          <div>
            <Label>Deal Name</Label>
            <Input
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder={`Campaign Lead - ${contactName}`}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={loading}>
            {loading ? 'Creating...' : 'Create Deal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
