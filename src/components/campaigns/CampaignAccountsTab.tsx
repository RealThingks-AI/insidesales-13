import { useState } from 'react';
import { useCampaignAccounts } from '@/hooks/useCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, X, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CAMPAIGN_ACCOUNT_STATUSES } from '@/types/campaign';

interface Props {
  campaignId: string;
}

export function CampaignAccountsTab({ campaignId }: Props) {
  const { query, addAccount, removeAccount, updateAccountStatus } = useCampaignAccounts(campaignId);
  const [addOpen, setAddOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const allAccountsQuery = useQuery({
    queryKey: ['all_accounts_for_campaign'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, account_name, industry, country').order('account_name');
      return data || [];
    },
    enabled: addOpen,
  });

  const existingIds = new Set((query.data || []).map(a => a.account_id));
  const availableAccounts = (allAccountsQuery.data || []).filter(
    a => !existingIds.has(a.id) && a.account_name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Target Accounts ({query.data?.length || 0})</span>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Add Account</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="end">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search accounts..." value={accountSearch} onChange={e => setAccountSearch(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {availableAccounts.map(a => (
                <button
                  key={a.id}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent truncate"
                  onClick={() => { addAccount.mutate({ accountId: a.id }); setAddOpen(false); }}
                >
                  {a.account_name}
                  {a.industry && <span className="text-muted-foreground ml-1">· {a.industry}</span>}
                </button>
              ))}
              {!availableAccounts.length && <p className="text-xs text-muted-foreground p-2">No accounts found</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!query.data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No accounts added yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map(ca => (
              <TableRow key={ca.id}>
                <TableCell className="font-medium text-sm">{ca.accounts?.account_name || '—'}</TableCell>
                <TableCell className="text-sm">{ca.accounts?.industry || '—'}</TableCell>
                <TableCell className="text-sm">{ca.accounts?.country || '—'}</TableCell>
                <TableCell>
                  <Select value={ca.status} onValueChange={v => updateAccountStatus.mutate({ id: ca.id, status: v })}>
                    <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_ACCOUNT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAccount.mutate(ca.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
