import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(401, { error: 'Autenticação necessária.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('INVITATION_EMAIL_FROM')
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (!supabaseUrl || !anonKey || !resendKey || !emailFrom || !appBaseUrl) {
    return json(503, { error: 'O envio de e-mail ainda não foi configurado no Supabase.' })
  }

  let code: string
  try {
    const body = await request.json()
    code = String(body?.code ?? '').toUpperCase().replace(/[^A-F0-9]/g, '')
  } catch {
    return json(400, { error: 'Corpo da solicitação inválido.' })
  }
  if (!/^[A-F0-9]{32}$/.test(code)) return json(400, { error: 'Código de convite inválido.' })

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'Sessão inválida ou expirada.' })

  const { data: details, error: detailsError } = await supabase
    .rpc('get_household_invitation_email', { p_code: code })
    .maybeSingle()
  if (detailsError) return json(400, { error: detailsError.message })
  if (!details?.recipient_email) return json(404, { error: 'Convite de e-mail não encontrado, expirado ou sem permissão.' })

  const inviteUrl = `${appBaseUrl.replace(/\/$/, '')}/convite?codigo=${code}`
  const expiresAt = new Date(details.expires_at).toLocaleString('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza',
  })
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#203c32;line-height:1.6">
      <div style="padding:24px;background:#f2f4ec;border-radius:16px">
        <p style="font-size:12px;letter-spacing:2px;font-weight:bold">DESPENSA INTELIGENTE</p>
        <h1 style="font-size:26px;margin:12px 0">Você foi convidado(a)!</h1>
        <p>Você recebeu um convite para participar da despensa compartilhada <strong>${escapeHtml(details.household_name)}</strong>.</p>
        <p style="margin:28px 0"><a href="${inviteUrl}" style="display:inline-block;background:#203c32;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Aceitar convite</a></p>
        <p>Entre ou crie sua conta usando este mesmo endereço de e-mail. O convite expira em ${expiresAt} e pode ser utilizado uma única vez.</p>
        <p style="font-size:12px;color:#66736a;word-break:break-all">Se o botão não funcionar, copie este link: ${inviteUrl}</p>
      </div>
    </div>`

  const mailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [details.recipient_email],
      subject: `Convite para a despensa: ${details.household_name}`,
      html,
    }),
  })
  const mailResult = await mailResponse.json().catch(() => ({}))
  if (!mailResponse.ok) {
    return json(502, { error: 'Não foi possível enviar o e-mail agora.', details: mailResult })
  }
  return json(200, { sent: true })
})

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }
  return String(value).replace(/[&<>"']/g, (character) => entities[character] ?? character)
}
