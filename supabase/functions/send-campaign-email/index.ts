import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAzureEmailConfig, getGraphAccessToken, sendEmailViaGraph } from "../_shared/azure-email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  campaign_id: string;
  contact_id: string;
  account_id?: string;
  template_id?: string;
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string;
  parent_id?: string;
  thread_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("MY_SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("MY_SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: EmailRequest = await req.json();
    if (!payload.subject || !payload.body || !payload.recipient_email) {
      return new Response(JSON.stringify({ error: "Missing required fields: subject, body, recipient_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Azure config
    const azureConfig = getAzureEmailConfig();
    if (!azureConfig) {
      console.error("Azure email credentials not configured");
      return new Response(JSON.stringify({
        success: false,
        error: "Email sending is not configured. Please ask your administrator to set up Azure email credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SENDER_EMAIL) in Supabase Edge Function secrets.",
        errorCode: "NOT_CONFIGURED",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getGraphAccessToken(azureConfig);
    } catch (err) {
      const errMsg = (err as Error).message;
      console.error("Failed to get Azure access token:", errMsg);

      // Log failed communication
      const messageId = crypto.randomUUID();
      await supabaseClient.from("campaign_communications").insert({
        campaign_id: payload.campaign_id,
        contact_id: payload.contact_id,
        account_id: payload.account_id || null,
        communication_type: "Email",
        subject: payload.subject,
        body: payload.body,
        email_status: "Failed",
        delivery_status: "failed",
        sent_via: "azure",
        template_id: payload.template_id || null,
        message_id: messageId,
        thread_id: payload.thread_id || null,
        parent_id: payload.parent_id || null,
        owner: user.id,
        created_by: user.id,
        notes: `Azure token error: ${errMsg}`,
        communication_date: new Date().toISOString(),
      });

      await supabaseClient.from("email_history").insert({
        subject: payload.subject,
        body: payload.body,
        recipient_email: payload.recipient_email,
        recipient_name: payload.recipient_name,
        sender_email: azureConfig.senderEmail,
        sent_by: user.id,
        contact_id: payload.contact_id,
        account_id: payload.account_id || null,
        status: "failed",
        sent_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        success: false,
        error: `Failed to authenticate with email provider: ${errMsg}`,
        errorCode: "AUTH_FAILED",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email
    const result = await sendEmailViaGraph(
      accessToken,
      azureConfig.senderEmail,
      payload.recipient_email,
      payload.recipient_name,
      payload.subject,
      payload.body,
    );

    const deliveryStatus = result.success ? "sent" : "failed";
    const messageId = crypto.randomUUID();
    const threadId = payload.thread_id || null;
    const parentId = payload.parent_id || null;

    // Log to campaign_communications
    const { data: commRecord, error: commError } = await supabaseClient
      .from("campaign_communications")
      .insert({
        campaign_id: payload.campaign_id,
        contact_id: payload.contact_id,
        account_id: payload.account_id || null,
        communication_type: "Email",
        subject: payload.subject,
        body: payload.body,
        email_status: result.success ? "Sent" : "Failed",
        delivery_status: deliveryStatus,
        sent_via: "azure",
        template_id: payload.template_id || null,
        message_id: messageId,
        thread_id: threadId,
        parent_id: parentId,
        owner: user.id,
        created_by: user.id,
        notes: result.error ? `Send error: ${result.error.substring(0, 500)}` : null,
        communication_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (commError) {
      console.error("Communication log error:", commError);
    }

    // Log to email_history
    await supabaseClient.from("email_history").insert({
      subject: payload.subject,
      body: payload.body,
      recipient_email: payload.recipient_email,
      recipient_name: payload.recipient_name,
      sender_email: azureConfig.senderEmail,
      sent_by: user.id,
      contact_id: payload.contact_id,
      account_id: payload.account_id || null,
      status: deliveryStatus,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        delivery_status: deliveryStatus,
        communication_id: commRecord?.id,
        message_id: messageId,
        error: result.error || undefined,
        errorCode: result.errorCode || undefined,
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err), errorCode: "UNEXPECTED" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
