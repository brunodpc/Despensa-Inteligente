import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Clock3, Copy, Link2, Mail, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Invitation = {
  id: string
  invited_email: string | null
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked'
}

type Props = { householdId: string; householdName: string; role: string }

function createSecureCode() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function formatCode(code: string) {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function HouseholdSettingsPage({ householdId, householdName, role }: Props) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [emailWarning, setEmailWarning] = useState('')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [newInvite, setNewInvite] = useState<{ code: string; link: string; email: string | null } | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const isAdmin = role === 'owner' || role === 'admin'

  const loadInvitations = useCallback(async () => {
    if (!supabase || !isAdmin) { setLoading(false); return }
    setLoading(true)
    const { data, error: listError } = await supabase.rpc('list_household_invitations', { p_household_id: householdId })
    if (listError) setError(listError.message)
    else setInvitations((data ?? []) as Invitation[])
    setLoading(false)
  }, [householdId, isAdmin])

  useEffect(() => { void loadInvitations() }, [loadInvitations])

  const pendingCount = useMemo(() => invitations.filter(item => item.invitation_status === 'pending').length, [invitations])

  async function createInvite(event: FormEvent<HTMLFormElement>, kind: 'email' | 'link') {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice(''); setEmailWarning(''); setNewInvite(null)
    const targetEmail = kind === 'email' ? email.trim().toLowerCase() : null
    const code = createSecureCode()
    const { error: createError } = await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
      p_code: code,
      p_email: targetEmail,
      p_expires_in_hours: 168,
    })
    if (createError) {
      setError(createError.message)
      setBusy(false)
      return
    }

    const link = `${window.location.origin}/convite?codigo=${code}`
    setNewInvite({ code, link, email: targetEmail })
    if (targetEmail) {
      const { data, error: sendError } = await supabase.functions.invoke('send-household-invitation', { body: { code } })
      if (sendError || data?.error) {
        setEmailWarning(sendError?.message || data?.error || 'O convite foi criado, mas o e-mail não foi enviado. Compartilhe o link manualmente ou configure o envio de e-mail.')
      } else {
        setNotice(`Convite criado e enviado para ${targetEmail}.`)
        setEmail('')
      }
    } else {
      setNotice('Convite por link criado. Compartilhe o link ou o código com a pessoa convidada.')
    }
    await loadInvitations()
    setBusy(false)
  }

  async function copy(value: string, type: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione e copie o conteúdo manualmente.')
    }
  }

  async function revoke(id: string) {
    if (!supabase || !window.confirm('Revogar este convite? O link/código deixará de funcionar.')) return
    setError(''); setNotice('')
    const { error: revokeError } = await supabase.rpc('revoke_household_invitation', { p_invitation_id: id })
    if (revokeError) setError(revokeError.message)
    else { setNotice('Convite revogado.'); await loadInvitations() }
  }

  if (!isAdmin) {
    return <div className="settings-page">
      <div className="feature-hero"><div className="feature-hero-icon"><ShieldCheck size={27}/></div><span className="eyebrow">SUA RESIDÊNCIA</span><h1>Configurações da casa</h1><p>Você participa de <strong>{householdName}</strong> como membro e tem acesso compartilhado completo às operações da cozinha. Somente o proprietário ou administrador pode gerenciar convites e membros.</p></div>
      <section className="panel settings-panel"><div className="panel-heading"><div><h2>Compartilhamento protegido</h2><p>Todos os membros podem cadastrar e editar produtos, registrar entradas, consumo e perdas, atualizar listas e registrar compras. O histórico fica compartilhado em tempo real. Apenas convites, remoção de membros e configurações administrativas são restritos ao proprietário/administrador.</p></div><Users size={20}/></div></section>
    </div>
  }

  return <div className="settings-page">
    <div className="page-heading-row settings-heading"><div><span className="eyebrow">SUA RESIDÊNCIA</span><h1>Configurações da casa</h1><p>Convide pessoas para compartilhar produtos, estoque, listas, compras e histórico. Todos os membros têm as mesmas permissões operacionais.</p></div><div className="settings-house-icon"><Users size={22}/></div></div>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>{householdName}</h2><p>Residência compartilhada · seu perfil: {role === 'owner' ? 'proprietário' : 'administrador'}</p></div><span className="settings-secure"><ShieldCheck size={15}/> Protegida</span></div>
      <div className="settings-stats"><div><span>Convites pendentes</span><strong>{pendingCount}</strong></div><div><span>Validade padrão</span><strong>7 dias</strong></div><div><span>Permissão de entrada</span><strong>Membro</strong></div></div>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>Permissões compartilhadas</h2><p>Todos os moradores podem cuidar da operação diária da cozinha.</p></div><ShieldCheck size={20}/></div>
      <p className="shared-permissions-copy">Qualquer membro pode cadastrar e editar produtos, registrar entradas e consumo, organizar listas, registrar compras e acompanhar preços. Somente proprietário e administradores podem convidar ou remover membros e alterar configurações administrativas.</p>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>Convidar alguém</h2><p>Escolha como deseja compartilhar o acesso à despensa.</p></div><Users size={20}/></div>
      <div className="invite-method-grid">
        <form className="invite-method-card" onSubmit={event => void createInvite(event, 'email')}>
          <div className="invite-method-icon"><Mail size={19}/></div><h3>Enviar por e-mail</h3><p>A pessoa recebe um convite no endereço informado. Somente esse e-mail poderá aceitá-lo.</p>
          <label htmlFor="invite-email">E-mail da pessoa</label><input id="invite-email" className="text-input" type="email" placeholder="pessoa@email.com" value={email} onChange={event => setEmail(event.target.value)} required/>
          <button className="button button-primary" disabled={busy || !email.trim()}>{busy ? 'Criando convite...' : 'Criar e enviar convite'}</button>
        </form>
        <form className="invite-method-card" onSubmit={event => void createInvite(event, 'link')}>
          <div className="invite-method-icon"><Link2 size={19}/></div><h3>Gerar link ou código</h3><p>Crie um convite que você pode compartilhar por mensagem ou mostrar pessoalmente.</p>
          <div className="invite-info"><Clock3 size={15}/> Válido por 7 dias · uso único</div>
          <button className="button button-secondary" disabled={busy}>{busy ? 'Gerando...' : 'Gerar convite compartilhável'}</button>
        </form>
      </div>
      {error && <div className="form-alert error settings-alert">{error}</div>}
      {notice && <div className="form-alert success settings-alert">{notice}</div>}
      {emailWarning && <div className="form-alert warning settings-alert">{emailWarning}</div>}
      {newInvite && <div className="invite-created">
        <div className="invite-created-heading"><div><Check size={17}/><strong>Convite criado</strong></div><span>Copie antes de sair desta tela</span></div>
        {newInvite.email && <p>Destinatário: <strong>{newInvite.email}</strong></p>}
        <label>Link de acesso</label><div className="copy-row"><input className="text-input" readOnly value={newInvite.link}/><button className="button button-secondary copy-button" onClick={() => void copy(newInvite.link, 'link')} type="button"><Copy size={15}/>{copied === 'link' ? 'Copiado' : 'Copiar link'}</button></div>
        <label>Código de convite</label><div className="copy-row"><input className="text-input invite-code-input" readOnly value={formatCode(newInvite.code)}/><button className="button button-secondary copy-button" onClick={() => void copy(newInvite.code, 'code')} type="button"><Copy size={15}/>{copied === 'code' ? 'Copiado' : 'Copiar código'}</button></div>
        <small>O código original não poderá ser recuperado depois. Guarde o link ou o código agora.</small>
      </div>}
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>Convites da residência</h2><p>Acompanhe, atualize ou revogue acessos ainda não utilizados.</p></div><button className="icon-button" title="Atualizar convites" onClick={() => void loadInvitations()}><RefreshCw size={17}/></button></div>
      {loading ? <div className="settings-empty">Carregando convites...</div> : invitations.length === 0 ? <div className="settings-empty">Nenhum convite criado ainda.</div> : <div className="invitation-list">{invitations.map(invite => <div className="invitation-row" key={invite.id}>
        <div className="invitation-avatar">{invite.invited_email ? invite.invited_email.slice(0, 1).toUpperCase() : <Link2 size={16}/>}</div>
        <div className="invitation-main"><strong>{invite.invited_email ?? 'Convite por link/código'}</strong><span>Criado em {formatDate(invite.created_at)} · expira em {formatDate(invite.expires_at)}</span></div>
        <span className={`invitation-status ${invite.invitation_status}`}>{({ pending: 'Pendente', accepted: 'Aceito', expired: 'Expirado', revoked: 'Revogado' })[invite.invitation_status]}</span>
        {invite.invitation_status === 'pending' && <button className="icon-button danger-icon" title="Revogar convite" onClick={() => void revoke(invite.id)}><Trash2 size={16}/></button>}
      </div>)}</div>}
    </section>
  </div>
}
