import { useState, Fragment, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, MessageSquare, AlertTriangle, ChevronDown, ChevronRight, Phone, ArrowUpDown, RefreshCw, Send, Mail, ListChecks, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { EmailComposeModal } from "./EmailComposeModal";

interface Props {
  campaignId: string;
  isCampaignEnded: boolean;
}

import { stageRanks } from "./campaignUtils";

export function CampaignCommunications({ campaignId, isCampaignEnded }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logCreate } = useCRUDAudit();
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<{ parent_id: string; thread_id: string | null; subject: string; contactId: string } | undefined>(undefined);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskContactId, setTaskContactId] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", description: "", due_date: "", priority: "Medium" });
  const [channelFilter, setChannelFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "threads">("list");

  const { data: communications = [], refetch } = useQuery({
    queryKey: ["campaign-communications", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_communications")
        .select("*, contacts(contact_name), accounts(account_name)")
        .eq("campaign_id", campaignId)
        .order("communication_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: campaignContacts = [] } = useQuery({
    queryKey: ["campaign-contacts-for-comms", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_contacts")
        .select("contact_id, account_id, contacts(contact_name, email, company_name, position)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: campaignAccounts = [] } = useQuery({
    queryKey: ["campaign-accounts-for-comms", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_accounts")
        .select("account_id, accounts(account_name)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: phoneScripts = [] } = useQuery({
    queryKey: ["campaign-phone-scripts", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_phone_scripts").select("*").eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const ownerIds = [...new Set(communications.map((c: any) => c.owner).filter(Boolean))] as string[];
  const { displayNames } = useUserDisplayNames(ownerIds);

  // Group communications into threads by contact
  const threads = useMemo(() => {
    const byContact: Record<string, any[]> = {};
    communications.forEach((c: any) => {
      const key = c.contact_id || "no-contact";
      if (!byContact[key]) byContact[key] = [];
      byContact[key].push(c);
    });
    return Object.entries(byContact).map(([contactId, msgs]) => ({
      contactId,
      contactName: msgs[0]?.contacts?.contact_name || "Unknown",
      accountName: msgs[0]?.accounts?.account_name || "",
      messages: msgs.sort((a, b) => new Date(a.communication_date || 0).getTime() - new Date(b.communication_date || 0).getTime()),
      lastActivity: msgs[0]?.communication_date,
      channelCounts: {
        Email: msgs.filter(m => m.communication_type === "Email").length,
        Call: msgs.filter(m => m.communication_type === "Call" || m.communication_type === "Phone").length,
        LinkedIn: msgs.filter(m => m.communication_type === "LinkedIn").length,
      },
    })).sort((a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime());
  }, [communications]);

  const [logForm, setLogForm] = useState({
    communication_type: "Email", contact_id: "", subject: "", body: "", notes: "",
    email_status: "Sent", call_outcome: "", linkedin_status: "Connection Sent",
  });

  const handleLogCommunication = async () => {
    if (isCampaignEnded) {
      toast({ title: "Campaign ended", description: "No further outreach can be logged.", variant: "destructive" });
      return;
    }

    const contactRecord = campaignContacts.find((cc: any) => cc.contact_id === logForm.contact_id);
    const accountId = contactRecord?.account_id || null;

    const { data: inserted, error } = await supabase.from("campaign_communications").insert({
      campaign_id: campaignId, contact_id: logForm.contact_id || null,
      account_id: accountId, communication_type: logForm.communication_type,
      subject: logForm.subject || null, body: logForm.body || null,
      notes: logForm.notes || null,
      email_status: logForm.communication_type === "Email" ? logForm.email_status : null,
      call_outcome: logForm.communication_type === "Call" ? logForm.call_outcome : null,
      linkedin_status: logForm.communication_type === "LinkedIn" ? logForm.linkedin_status : null,
      delivery_status: logForm.communication_type === "Email" ? "manual" : null,
      sent_via: "manual",
      owner: user!.id, created_by: user!.id,
      communication_date: new Date().toISOString(),
    }).select("id").single();

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Rank-based MAX stage logic
    if (logForm.contact_id) {
      const channelStageMap: Record<string, string> = { Email: "Email Sent", Call: "Phone Contacted", Phone: "Phone Contacted", LinkedIn: "LinkedIn Contacted" };
      const newStage = channelStageMap[logForm.communication_type];
      const newRank = stageRanks[newStage] ?? 0;

      const { data: currentContact } = await supabase
        .from("campaign_contacts").select("stage")
        .eq("campaign_id", campaignId).eq("contact_id", logForm.contact_id).single();

      const currentRank = stageRanks[currentContact?.stage || "Not Contacted"] ?? 0;
      if (newRank > currentRank) {
        await supabase.from("campaign_contacts").update({ stage: newStage })
          .eq("campaign_id", campaignId).eq("contact_id", logForm.contact_id);
      }
    }

    // Recompute account status
    if (accountId) {
      const { data: acContacts } = await supabase.from("campaign_contacts")
        .select("stage").eq("campaign_id", campaignId).eq("account_id", accountId);
      const contacts = acContacts || [];
      let derivedStatus = "Not Contacted";
      if (contacts.some((c: any) => c.stage === "Qualified")) derivedStatus = "Deal Created";
      else if (contacts.some((c: any) => c.stage === "Responded")) derivedStatus = "Responded";
      else if (contacts.some((c: any) => c.stage !== "Not Contacted")) derivedStatus = "Contacted";
      await supabase.from("campaign_accounts").update({ status: derivedStatus })
        .eq("campaign_id", campaignId).eq("account_id", accountId);
    }

    queryClient.invalidateQueries({ queryKey: ["campaign-communications", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-contacts", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-accounts", campaignId] });
    setLogModalOpen(false);

    await logCreate('campaign_communications', inserted?.id || '', {
      campaign_id: campaignId,
      communication_type: logForm.communication_type,
      contact_id: logForm.contact_id,
      subject: logForm.subject,
    });

    setLogForm({ communication_type: "Email", contact_id: "", subject: "", body: "", notes: "", email_status: "Sent", call_outcome: "", linkedin_status: "Connection Sent" });
    toast({ title: "Communication logged" });
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) { toast({ title: "Task title is required", variant: "destructive" }); return; }

    const { data: inserted, error } = await supabase.from("action_items").insert({
      title: taskForm.title,
      description: taskForm.description || null,
      due_date: taskForm.due_date || null,
      priority: taskForm.priority,
      status: "Open",
      module_type: "campaigns",
      module_id: campaignId,
      created_by: user!.id,
      assigned_to: user!.id,
    }).select("id").single();

    if (error) { toast({ title: "Error creating task", description: error.message, variant: "destructive" }); return; }

    await logCreate('action_items', inserted?.id || '', {
      title: taskForm.title,
      module_type: 'campaigns',
      campaign_id: campaignId,
      contact_id: taskContactId,
    });

    setTaskModalOpen(false);
    setTaskForm({ title: "", description: "", due_date: "", priority: "Medium" });
    setTaskContactId("");
    toast({ title: "Task created" });
  };

  const openTaskForContact = (contactId: string, contactName: string) => {
    setTaskContactId(contactId);
    setTaskForm({ title: `Follow up with ${contactName}`, description: "", due_date: "", priority: "Medium" });
    setTaskModalOpen(true);
  };

  const openReply = (msg: any) => {
    setReplyContext({
      parent_id: msg.id,
      thread_id: msg.thread_id || msg.id,
      subject: msg.subject || "",
      contactId: msg.contact_id,
    });
    setEmailComposeOpen(true);
  };

  const handleEmailSent = async (sentContactId?: string) => {
    // Update contact stage after email sent via compose modal
    if (sentContactId) {
      const newStage = "Email Sent";
      const newRank = stageRanks[newStage] ?? 0;
      const { data: currentContact } = await supabase
        .from("campaign_contacts").select("stage, account_id")
        .eq("campaign_id", campaignId).eq("contact_id", sentContactId).single();
      const currentRank = stageRanks[currentContact?.stage || "Not Contacted"] ?? 0;
      if (newRank > currentRank) {
        await supabase.from("campaign_contacts").update({ stage: newStage })
          .eq("campaign_id", campaignId).eq("contact_id", sentContactId);
      }
      // Recompute account status
      const accountId = currentContact?.account_id;
      if (accountId) {
        const { data: acContacts } = await supabase.from("campaign_contacts")
          .select("stage").eq("campaign_id", campaignId).eq("account_id", accountId);
        const acList = acContacts || [];
        let derivedStatus = "Not Contacted";
        if (acList.some((c: any) => c.stage === "Qualified")) derivedStatus = "Deal Created";
        else if (acList.some((c: any) => c.stage === "Responded")) derivedStatus = "Responded";
        else if (acList.some((c: any) => c.stage !== "Not Contacted")) derivedStatus = "Contacted";
        await supabase.from("campaign_accounts").update({ status: derivedStatus })
          .eq("campaign_id", campaignId).eq("account_id", accountId);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["campaign-communications", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-contacts", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-accounts", campaignId] });
  };

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = communications.filter((c: any) => {
    if (channelFilter !== "all") {
      if (channelFilter === "Call") {
        if (c.communication_type !== "Call" && c.communication_type !== "Phone") return false;
      } else if (c.communication_type !== channelFilter) return false;
    }
    if (accountFilter !== "all" && c.account_id !== accountFilter) return false;
    if (contactFilter !== "all" && c.contact_id !== contactFilter) return false;
    if (ownerFilter !== "all" && c.owner !== ownerFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = c.contacts?.contact_name?.toLowerCase().includes(q) ||
        c.accounts?.account_name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.communication_date || 0).getTime();
    const dateB = new Date(b.communication_date || 0).getTime();
    return sortAsc ? dateA - dateB : dateB - dateA;
  });

  const channelBadge = (type: string) => {
    const normalizedType = type === "Phone" ? "Call" : type;
    const colors: Record<string, string> = {
      Email: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      Call: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      LinkedIn: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return <Badge className={colors[normalizedType] || ""} variant="secondary">{normalizedType}</Badge>;
  };

  const deliveryBadge = (commType: string, status: string | null) => {
    const normalizedType = commType === "Phone" ? "Call" : commType;
    if (normalizedType === "Call" || normalizedType === "LinkedIn") return null;
    if (!status) return null;
    const colors: Record<string, string> = {
      sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      manual: "bg-muted text-muted-foreground",
    };
    return <Badge className={`text-[10px] ${colors[status] || ""}`} variant="secondary">{status}</Badge>;
  };

  const accountOptions = campaignAccounts.map((ca: any) => ({ id: ca.account_id, name: ca.accounts?.account_name || "Unknown" }));
  const contactOptions = campaignContacts.map((cc: any) => ({ id: cc.contact_id, name: cc.contacts?.contact_name || "Unknown" }));

  return (
    <div className="space-y-3">
      <Card className="border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Outreach ({communications.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="h-8">
              <TabsList className="h-7">
                <TabsTrigger value="list" className="text-xs h-6 px-2">List</TabsTrigger>
                <TabsTrigger value="threads" className="text-xs h-6 px-2">Threads</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            {!isCampaignEnded ? (
              <div className="flex gap-1.5">
                <Button size="sm" variant="default" className="gap-1" onClick={() => setEmailComposeOpen(true)}>
                  <Send className="h-3.5 w-3.5" /> Send Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLogModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Log
                </Button>
              </div>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Ended</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[150px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
            {contactOptions.length > 0 && (
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  {contactOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {accountOptions.length > 0 && (
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accountOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {ownerIds.length > 0 && (
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {ownerIds.map((oid) => <SelectItem key={oid} value={oid}>{displayNames[oid] || oid}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Thread View */}
          {viewMode === "threads" && (
            <div className="space-y-2">
              {threads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No outreach logged yet.</p>
                </div>
              ) : (
                threads.map(thread => (
                  <Card key={thread.contactId} className="border">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="py-2.5 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{thread.contactName}</span>
                              {thread.accountName && <span className="text-xs text-muted-foreground">· {thread.accountName}</span>}
                              <span className="text-xs text-muted-foreground">({thread.messages.length} messages)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {thread.channelCounts.Email > 0 && <Badge variant="secondary" className="text-[10px] gap-0.5"><Mail className="h-2.5 w-2.5" />{thread.channelCounts.Email}</Badge>}
                              {thread.channelCounts.Call > 0 && <Badge variant="secondary" className="text-[10px] gap-0.5"><Phone className="h-2.5 w-2.5" />{thread.channelCounts.Call}</Badge>}
                              {thread.channelCounts.LinkedIn > 0 && <Badge variant="secondary" className="text-[10px] gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{thread.channelCounts.LinkedIn}</Badge>}
                              {!isCampaignEnded && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-0.5" onClick={(e) => { e.stopPropagation(); openTaskForContact(thread.contactId, thread.contactName); }}>
                                  <ListChecks className="h-3 w-3" /> Task
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 px-4 pb-3">
                          <div className="space-y-2 border-l-2 border-muted pl-3">
                            {thread.messages.map((msg: any) => (
                              <div key={msg.id} className="text-sm">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {channelBadge(msg.communication_type)}
                                  <span>{msg.communication_date ? format(new Date(msg.communication_date), "dd MMM yyyy HH:mm") : "—"}</span>
                                  {deliveryBadge(msg.communication_type, msg.delivery_status)}
                                  {msg.sent_via === "azure" && <Badge variant="outline" className="text-[10px] px-1 py-0">Sent via email</Badge>}
                                  {msg.parent_id && <Badge variant="outline" className="text-[10px] px-1 py-0">Reply</Badge>}
                                  <span className="ml-auto flex items-center gap-1">
                                    {!isCampaignEnded && msg.communication_type === "Email" && msg.contact_id && (
                                      <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1.5" onClick={(e) => { e.stopPropagation(); openReply(msg); }}>
                                        <Reply className="h-3 w-3" /> Reply
                                      </Button>
                                    )}
                                    {msg.owner ? displayNames[msg.owner] || "—" : "—"}
                                  </span>
                                </div>
                                {msg.subject && <p className="font-medium mt-0.5">{msg.subject}</p>}
                                {msg.body && <p className="text-muted-foreground whitespace-pre-wrap mt-0.5 text-xs">{msg.body.substring(0, 200)}{msg.body.length > 200 ? "..." : ""}</p>}
                                {msg.notes && <p className="text-xs italic text-muted-foreground mt-0.5">Note: {msg.notes}</p>}
                                {msg.email_status && <span className="text-xs text-muted-foreground">Status: {msg.email_status}</span>}
                                {msg.call_outcome && <span className="text-xs text-muted-foreground">Outcome: {msg.call_outcome}</span>}
                                {msg.linkedin_status && <span className="text-xs text-muted-foreground">LinkedIn: {msg.linkedin_status}</span>}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <>
              {sorted.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No outreach logged yet. Use "Send Email" to compose or "Log" to record outreach.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => setSortAsc(!sortAsc)}>
                        <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((c: any) => (
                      <Fragment key={c.id}>
                        <TableRow className="cursor-pointer" onClick={() => toggleExpand(c.id)}>
                          <TableCell className="px-2">
                            {expandedRows.has(c.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{c.communication_date ? format(new Date(c.communication_date), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                          <TableCell>{channelBadge(c.communication_type)}</TableCell>
                          <TableCell className="font-medium">{c.contacts?.contact_name || "—"}</TableCell>
                          <TableCell>{c.accounts?.account_name || "—"}</TableCell>
                          <TableCell>{c.email_status || c.call_outcome || c.linkedin_status || "—"}</TableCell>
                          <TableCell>{deliveryBadge(c.communication_type, c.delivery_status)}</TableCell>
                          <TableCell className="text-sm">{c.owner ? displayNames[c.owner] || "—" : "—"}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              {!isCampaignEnded && c.communication_type === "Email" && c.contact_id && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-0.5"
                                  onClick={() => openReply(c)}>
                                  <Reply className="h-3 w-3" />
                                </Button>
                              )}
                              {!isCampaignEnded && c.contacts?.contact_name && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-0.5"
                                  onClick={() => openTaskForContact(c.contact_id, c.contacts?.contact_name || "")}>
                                  <ListChecks className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(c.id) && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {c.subject && <div><span className="text-muted-foreground">Subject:</span> {c.subject}</div>}
                                {c.body && <div><span className="text-muted-foreground">Body:</span> <span className="whitespace-pre-wrap">{c.body}</span></div>}
                                {c.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {c.notes}</div>}
                                {c.communication_type === "Email" && c.email_status && <div><span className="text-muted-foreground">Email Status:</span> {c.email_status}</div>}
                                {c.communication_type === "Call" && c.call_outcome && <div><span className="text-muted-foreground">Outcome:</span> {c.call_outcome}</div>}
                                {c.communication_type === "LinkedIn" && c.linkedin_status && <div><span className="text-muted-foreground">LinkedIn Status:</span> {c.linkedin_status}</div>}
                                {c.delivery_status && <div><span className="text-muted-foreground">Delivery:</span> {c.delivery_status} {c.sent_via && `(via ${c.sent_via})`}</div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Compose Modal */}
      <EmailComposeModal
        open={emailComposeOpen}
        onOpenChange={(v) => { setEmailComposeOpen(v); if (!v) setReplyContext(undefined); }}
        campaignId={campaignId}
        contacts={campaignContacts as any}
        replyTo={replyContext}
        onEmailSent={handleEmailSent}
      />

      {/* Log Outreach Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className={`${logForm.communication_type === "Call" && phoneScripts.length > 0 ? "sm:max-w-[900px]" : "sm:max-w-[500px]"} max-h-[85vh] overflow-y-auto`}>
          <DialogHeader><DialogTitle>Log Outreach</DialogTitle></DialogHeader>
          <div className={logForm.communication_type === "Call" && phoneScripts.length > 0 ? "grid grid-cols-2 gap-6" : ""}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Channel *</Label>
                <Select value={logForm.communication_type} onValueChange={(v) => setLogForm({ ...logForm, communication_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Select value={logForm.contact_id} onValueChange={(v) => setLogForm({ ...logForm, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {campaignContacts.map((cc: any) => (
                      <SelectItem key={cc.contact_id} value={cc.contact_id}>{cc.contacts?.contact_name || cc.contact_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {logForm.communication_type === "Email" && (
                <>
                  <div className="space-y-2"><Label>Subject</Label><Input value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Body</Label><Textarea value={logForm.body} onChange={(e) => setLogForm({ ...logForm, body: e.target.value })} rows={3} /></div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={logForm.email_status} onValueChange={(v) => setLogForm({ ...logForm, email_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sent">Sent</SelectItem><SelectItem value="Delivered">Delivered</SelectItem><SelectItem value="Opened">Opened</SelectItem><SelectItem value="Replied">Replied</SelectItem><SelectItem value="Bounced">Bounced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {logForm.communication_type === "Call" && (
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={logForm.call_outcome} onValueChange={(v) => setLogForm({ ...logForm, call_outcome: v })}>
                    <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interested">Interested</SelectItem><SelectItem value="Not Interested">Not Interested</SelectItem>
                      <SelectItem value="Call Later">Call Later</SelectItem><SelectItem value="Wrong Contact">Wrong Contact</SelectItem>
                      <SelectItem value="No Answer">No Answer</SelectItem><SelectItem value="Voicemail">Voicemail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {logForm.communication_type === "LinkedIn" && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={logForm.linkedin_status} onValueChange={(v) => setLogForm({ ...logForm, linkedin_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Connection Sent">Connection Sent</SelectItem><SelectItem value="Connected">Connected</SelectItem>
                      <SelectItem value="Message Sent">Message Sent</SelectItem><SelectItem value="InMail Sent">InMail Sent</SelectItem>
                      <SelectItem value="Responded">Responded</SelectItem><SelectItem value="Not Interested">Not Interested</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2"><Label>Notes</Label><Textarea value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} rows={3} /></div>
            </div>

            {logForm.communication_type === "Call" && phoneScripts.length > 0 && (
              <div className="border-l border-border pl-6 py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Phone className="h-4 w-4 text-primary" /> Call Script Reference</div>
                {phoneScripts.map((script: any) => (
                  <Collapsible key={script.id} defaultOpen={phoneScripts.length === 1}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-medium p-2 rounded hover:bg-muted/50">
                      <ChevronDown className="h-3.5 w-3.5" /> {script.script_name || "Script"}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-2 text-sm text-muted-foreground">
                      {script.opening_script && <div><p className="font-medium text-foreground text-xs">Opening</p><p className="whitespace-pre-wrap">{script.opening_script}</p></div>}
                      {script.key_talking_points && <div><p className="font-medium text-foreground text-xs">Key Points</p>{(() => { try { const pts = JSON.parse(script.key_talking_points); if (Array.isArray(pts)) return <ul className="list-disc ml-4">{pts.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>; } catch {} return <p className="whitespace-pre-wrap">{script.key_talking_points}</p>; })()}</div>}
                      {script.discovery_questions && <div><p className="font-medium text-foreground text-xs">Questions</p>{(() => { try { const qs = JSON.parse(script.discovery_questions); if (Array.isArray(qs)) return <ul className="list-disc ml-4">{qs.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>; } catch {} return <p className="whitespace-pre-wrap">{script.discovery_questions}</p>; })()}</div>}
                      {script.objection_handling && <div><p className="font-medium text-foreground text-xs">Objections</p>{(() => { try { const objs = JSON.parse(script.objection_handling); if (Array.isArray(objs)) return <div className="space-y-1">{objs.map((o: any, i: number) => <div key={i} className="border-l-2 border-muted pl-2"><p className="text-xs"><strong>Q:</strong> {o.objection}</p><p className="text-xs"><strong>A:</strong> {o.response}</p></div>)}</div>; } catch {} return <p className="whitespace-pre-wrap">{script.objection_handling}</p>; })()}</div>}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogModalOpen(false)}>Cancel</Button>
            <Button onClick={handleLogCommunication}>Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Create Follow-up Task</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title..." className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Additional details..." rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className="text-sm h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
