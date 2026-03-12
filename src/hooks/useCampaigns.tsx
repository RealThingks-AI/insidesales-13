import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Campaign, CampaignAccount, CampaignContact, CampaignCommunication, CampaignMaterial } from '@/types/campaign';

export function useCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user,
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...campaign, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign created successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error creating campaign', description: err.message, variant: 'destructive' });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ ...updates, modified_by: user!.id, modified_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign updated successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating campaign', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting campaign', description: err.message, variant: 'destructive' });
    },
  });

  return { campaignsQuery, createCampaign, updateCampaign, deleteCampaign };
}

export function useCampaignAccounts(campaignId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['campaign_accounts', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_accounts')
        .select('*, accounts(account_name, industry, country, account_owner)')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignAccount[];
    },
    enabled: !!campaignId && !!user,
  });

  const addAccount = useMutation({
    mutationFn: async ({ accountId }: { accountId: string }) => {
      const { error } = await supabase.from('campaign_accounts').insert({
        campaign_id: campaignId,
        account_id: accountId,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
    onError: (err: any) => {
      toast({ title: 'Error adding account', description: err.message, variant: 'destructive' });
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
  });

  const updateAccountStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('campaign_accounts').update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
  });

  return { query, addAccount, removeAccount, updateAccountStatus };
}

export function useCampaignContacts(campaignId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['campaign_contacts', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_contacts')
        .select('*, contacts(contact_name, email, phone_no, linkedin, position, company_name)')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignContact[];
    },
    enabled: !!campaignId && !!user,
  });

  const addContact = useMutation({
    mutationFn: async ({ contactId, accountId }: { contactId: string; accountId?: string }) => {
      const { error } = await supabase.from('campaign_contacts').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        account_id: accountId || null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
    onError: (err: any) => {
      toast({ title: 'Error adding contact', description: err.message, variant: 'destructive' });
    },
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
  });

  const updateContactStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from('campaign_contacts').update({ stage } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
  });

  return { query, addContact, removeContact, updateContactStage };
}

export function useCampaignCommunications(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_communications', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_communications')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('communication_date', { ascending: false });
      if (error) throw error;
      return data as CampaignCommunication[];
    },
    enabled: !!campaignId && !!user,
  });

  const addCommunication = useMutation({
    mutationFn: async (comm: Partial<CampaignCommunication>) => {
      const { error } = await supabase.from('campaign_communications').insert({
        ...comm,
        campaign_id: campaignId,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_communications', campaignId] });
      toast({ title: 'Communication logged' });
    },
    onError: (err: any) => {
      toast({ title: 'Error logging communication', description: err.message, variant: 'destructive' });
    },
  });

  return { query, addCommunication };
}

export function useCampaignMaterials(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_materials', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_materials')
        .select('*')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignMaterial[];
    },
    enabled: !!campaignId && !!user,
  });

  const uploadMaterial = useMutation({
    mutationFn: async ({ file, fileType }: { file: File; fileType: string }) => {
      const filePath = `${user!.id}/${campaignId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-materials')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('campaign_materials').insert({
        campaign_id: campaignId,
        file_name: file.name,
        file_path: filePath,
        file_type: fileType,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_materials', campaignId] });
      toast({ title: 'Material uploaded' });
    },
    onError: (err: any) => {
      toast({ title: 'Error uploading material', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from('campaign-materials').remove([filePath]);
      const { error } = await supabase.from('campaign_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_materials', campaignId] });
      toast({ title: 'Material deleted' });
    },
  });

  return { query, uploadMaterial, deleteMaterial };
}
