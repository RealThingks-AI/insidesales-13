import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    
    // Verify user token
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

    // Get Azure credentials
    const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID") || Deno.env.get("AZURE_TENANT_ID");
    const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID") || Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET") || Deno.env.get("AZURE_CLIENT_SECRET");
    const senderEmail = Deno.env.get("AZURE_SENDER_EMAIL");

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      return new Response(JSON.stringify({ error: "Azure email credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Azure access token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      console.error("Azure token error:", tokenData);
      return new Response(JSON.stringify({ error: "Failed to get Azure access token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Microsoft Graph
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const emailPayload = {
      message: {
        subject: payload.subject,
        body: {
          contentType: "HTML",
          content: payload.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: payload.recipient_email,
              name: payload.recipient_name,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    const sendResp = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const deliveryStatus = sendResp.ok ? "sent" : "failed";
    let errorMessage = "";
    if (!sendResp.ok) {
      const errBody = await sendResp.text();
      console.error("Send email error:", errBody);
      errorMessage = errBody;
    }

    // Log to campaign_communications
    const messageId = crypto.randomUUID();
    const threadId = payload.thread_id || null;
    const parentId = payload.parent_id || null;
    const { data: commRecord, error: commError } = await supabaseClient
      .from("campaign_communications")
      .insert({
        campaign_id: payload.campaign_id,
        contact_id: payload.contact_id,
        account_id: payload.account_id || null,
        communication_type: "Email",
        subject: payload.subject,
        body: payload.body,
        email_status: deliveryStatus === "sent" ? "Sent" : "Failed",
        delivery_status: deliveryStatus,
        sent_via: "azure",
        template_id: payload.template_id || null,
        message_id: messageId,
        thread_id: threadId,
        parent_id: parentId,
        owner: user.id,
        created_by: user.id,
        communication_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (commError) {
      console.error("Communication log error:", commError);
    }

    // Also log to email_history for global tracking
    await supabaseClient.from("email_history").insert({
      subject: payload.subject,
      body: payload.body,
      recipient_email: payload.recipient_email,
      recipient_name: payload.recipient_name,
      sender_email: senderEmail,
      sent_by: user.id,
      contact_id: payload.contact_id,
      account_id: payload.account_id || null,
      status: deliveryStatus,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: deliveryStatus === "sent",
        delivery_status: deliveryStatus,
        communication_id: commRecord?.id,
        message_id: messageId,
        error: errorMessage || undefined,
      }),
      {
        status: deliveryStatus === "sent" ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
