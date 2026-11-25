# Testes de aceitação — convites da residência

Execute em um projeto Supabase de desenvolvimento com duas contas distintas (A e B). Não use contas ou dados de produção.

## Pré-condições

- Aplicar as migrations `202611240001_initial_schema.sql` e `202611240002_household_invitations.sql`.
- Conta A autenticada e proprietária de uma residência.
- Conta B autenticada e ainda sem residência.
- A Edge Function de e-mail pode ficar sem configuração para testar somente link/código.

## Casos funcionais e de segurança

1. **Gerar link/código:** A cria convite sem e-mail. O registro aparece como pendente; o código não aparece em nenhuma resposta de listagem ou tabela acessível ao cliente.
2. **Aceitar convite:** B abre `/convite?codigo=...`, autentica e passa a ser membro da residência de A.
3. **Uso único:** B tenta aceitar novamente o mesmo código. A operação deve falhar sem duplicar membership.
4. **Expiração:** criar convite com validade curta em ambiente de teste, esperar a expiração e confirmar que a aceitação falha.
5. **Revogação:** A revoga um convite pendente; a aceitação posterior deve falhar.
6. **Convite por e-mail:** A informa um endereço específico. Outra conta com e-mail diferente tenta aceitar e deve receber erro de autorização.
7. **E-mail correto:** a conta com o mesmo e-mail aceita o convite.
8. **Permissão:** uma conta membro (não admin) tenta criar, listar ou revogar convites. Todas as operações devem ser negadas.
9. **Isolamento:** um usuário de outra residência não consegue listar convites nem enviar e-mail de convites alheios.
10. **Uma residência por conta:** uma conta que já participa de uma residência tenta aceitar convite de outra; a operação deve falhar.
11. **Concorrência:** duas sessões tentam aceitar convites para residências diferentes com a mesma conta. A restrição única em `household_members.user_id` deve permitir apenas uma associação.

## Envio de e-mail

- Configurar domínio remetente verificado no Resend.
- Definir `RESEND_API_KEY`, `INVITATION_EMAIL_FROM` e `APP_BASE_URL` como secrets da Edge Function.
- Deploy da função e teste de recebimento, expiração e correspondência do e-mail.

## Resultado esperado

Nenhum usuário sem autenticação entra na residência; convite por e-mail só pode ser aceito pela conta de destino; links/códigos são de uso único, expiráveis e revogáveis; nenhuma chave secreta é enviada ao navegador.
