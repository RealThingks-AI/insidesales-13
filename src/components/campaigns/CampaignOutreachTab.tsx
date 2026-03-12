import { useState } from 'react';
import { useCampaignCommunications, useCampaignContacts } from '@/hooks/useCampaigns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Mail, Phone, Linkedin, Calendar, RefreshCw } from 'lucide-react';
import { COMMUNICATION_TYPES, EMAIL_TYPES, EMAIL_STATUSES, CALL_OUTCOMES, LINKEDIN_STATUSES } from '@/types/campaign';
import { format } from 'date-fns';

const typeIcons: Record<string, any> = {
  Email: Mail,
  Phone: Phone,
  LinkedIn: Linkedin,
  Meeting: Calendar,
  'Follow Up': RefreshCw,
};

interface Props {
  campaignId: string;
}

export function CampaignOutreachTab({ campaignId }: Props) {
  const { query, addCommunication } = useCampaignCommunications(campaignId);
  const contactsQuery = useCampaignContacts(campaignId);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({
    communication_type: 'Email',
    contact_id: '',
    subject: '',
    body: '',
    email_type: '',
    email_status: 'Sent',
    linkedin_status: '',
    call_outcome: '',
    notes: '',
    outcome: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLog = async () => {
    await addCommunication.mutateAsync({
      communication_type: form.communication_type,
      contact_id: form.contact_id || null,
      subject: form.subject || null,
      body: form.body || null,
      email_type: form.email_type || null,
      email_status: form.communication_type === 'Email' ? form.email_status : null,
      linkedin_status: form.communication_type === 'LinkedIn' ? form.linkedin_status : null,
      call_outcome: form.communication_type === 'Phone' ? form.call_outcome : null,
      notes: form.notes || null,
      outcome: form.outcome || null,
    });
    setLogOpen(false);
    setForm({ communication_type: 'Email', contact_id: '', subject: '', body: '', email_type: '', email_status: 'Sent', linkedin_status: '', call_outcome: '', notes: '', outcome: '' });
  };

  const contacts = contactsQuery.query.data || [];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Communications ({query.data?.length || 0})</span>
        <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Log Communication
        </Button>
      </div>

      {!query.data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No communications logged yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status/Outcome</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map(c => {
              const Icon = typeIcons[c.communication_type] || Mail;
              const statusText = c.email_status || c.call_outcome || c.linkedin_status || c.outcome || '—';
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.communication_type}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.subject || '—'}</TableCell>
                  <TableCell className="text-sm">{statusText}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.communication_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.communication_type} onValueChange={v => set('communication_type', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={v => set('contact_id', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.contact_id} value={c.contact_id}>{c.contacts?.contact_name || c.contact_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} className="h-9" />
            </div>

            {form.communication_type === 'Email' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email Type</Label>
                  <Select value={form.email_type} onValueChange={v => set('email_type', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{EMAIL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email Status</Label>
                  <Select value={form.email_status} onValueChange={v => set('email_status', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMAIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.communication_type === 'Phone' && (
              <div>
                <Label>Call Outcome</Label>
                <Select value={form.call_outcome} onValueChange={v => set('call_outcome', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>{CALL_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.communication_type === 'LinkedIn' && (
              <div>
                <Label>LinkedIn Status</Label>
                <Select value={form.linkedin_status} onValueChange={v => set('linkedin_status', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{LINKEDIN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={handleLog}>Log</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
