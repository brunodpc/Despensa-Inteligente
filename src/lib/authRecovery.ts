// Link enviado pelo Supabase volta para a página inicial com ?recuperar=1.
// Os tokens de recuperação vêm no hash da URL e são lidos pelo próprio SDK.
export function passwordResetRedirectUrl() {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`

  // Nos builds nativos (Capacitor) o app roda em localhost sem porta;
  // nesse caso o link volta para a versão web, onde a troca é concluída.
  const nativeHost = window.location.hostname === 'localhost' && window.location.port === ''
  if (nativeHost) return 'https://brunodpc.github.io/Despensa-Inteligente/?recuperar=1'

  return `${window.location.origin}${normalizedBase}?recuperar=1`
}
