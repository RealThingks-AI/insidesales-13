import { useState } from 'react';
import { useCampaignContacts } from '@/hooks/useCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, X, Search, ArrowRightCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CAMPAIGN_CONTACT_STAGES } from '@/types/campaign';
import { ConvertToDealDialog } from './ConvertToDealDialog';
import type { CampaignContact } from '@/types/campaign';

interface Props {
  campaignId: string;
}

export function CampaignContactsTab({ campaignId }: Props) {
  const { query, addContact, removeContact, updateContactStage } = useCampaignContacts(campaignId);
  const [addOpen, setAddOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [convertContact, setConvertContact] = useState<CampaignContact | null>(null);

  const allContactsQuery = useQuery({
    queryKey: ['all_contacts_for_campaign'],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, contact_name, email, position, company_name').order('contact_name');
      return data || [];
    },
    enabled: addOpen,
  });

  const existingIds = new Set((query.data || []).map(c => c.contact_id));
  const availableContacts = (allContactsQuery.data || []).filter(
    c => !existingIds.has(c.id) && c.contact_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Target Contacts ({query.data?.length || 0})</span>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Add Contact</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="end">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {availableContacts.map(c => (
                <button
                  key={c.id}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent truncate"
                  onClick={() => { addContact.mutate({ contactId: c.id }); setAddOpen(false); }}
                >
                  {c.contact_name}
                  {c.position && <span className="text-muted-foreground ml-1">· {c.position}</span>}
                </button>
              ))}
              {!availableContacts.length && <p className="text-xs text-muted-foreground p-2">No contacts found</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!query.data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No contacts added yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map(cc => (
              <TableRow key={cc.id}>
                <TableCell className="font-medium text-sm">{cc.contacts?.contact_name || '—'}</TableCell>
                <TableCell className="text-sm">{cc.contacts?.email || '—'}</TableCell>
                <TableCell className="text-sm">{cc.contacts?.position || '—'}</TableCell>
                <TableCell>
                  <Select value={cc.stage} onValueChange={v => updateContactStage.mutate({ id: cc.id, stage: v })}>
                    <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_CONTACT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {(cc.stage === 'Responded' || cc.stage === 'Qualified') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        title="Convert to Deal"
                        onClick={() => setConvertContact(cc)}
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeContact.mutate(cc.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConvertToDealDialog
        open={!!convertContact}
        onOpenChange={() => setConvertContact(null)}
        campaignId={campaignId}
        campaignContact={convertContact}
      />
    </div>
  );
}
