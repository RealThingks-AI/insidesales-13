import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Campaign } from '@/types/campaign';
import { format } from 'date-fns';

interface CampaignListProps {
  campaigns: Campaign[];
  loading: boolean;
  onSelect: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  selectedId?: string;
}

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Active: 'bg-primary/10 text-primary',
  Paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Cancelled: 'bg-destructive/10 text-destructive',
};

export function CampaignList({ campaigns, loading, onSelect, onEdit, onDelete, selectedId }: CampaignListProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No campaigns found</p>
        <p className="text-xs mt-1">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaign Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Region</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map(c => (
          <TableRow
            key={c.id}
            className={`cursor-pointer ${selectedId === c.id ? 'bg-accent' : ''}`}
            onClick={() => onSelect(c)}
          >
            <TableCell className="font-medium">{c.campaign_name}</TableCell>
            <TableCell className="text-sm">{c.campaign_type || '—'}</TableCell>
            <TableCell>
              <Badge variant="outline" className={statusColors[c.status] || ''}>
                {c.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">{c.start_date ? format(new Date(c.start_date), 'dd MMM yyyy') : '—'}</TableCell>
            <TableCell className="text-sm">{c.end_date ? format(new Date(c.end_date), 'dd MMM yyyy') : '—'}</TableCell>
            <TableCell className="text-sm">{c.region || '—'}</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(c); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onDelete(c.id); }} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
