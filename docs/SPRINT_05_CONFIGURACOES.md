# Sprint 05 — Configurações de conta e aplicativo

## O que mudou

- A rota `/configuracoes` deixou de apontar para a página genérica de módulo planejado.
- O modo demonstração agora abre a tela real de configurações, com indicação clara de que os dados são locais.
- A tela reúne perfil, segurança da conta, preferências do aplicativo, residência/compartilhamento e informações da versão.
- Em contas autenticadas, o nome de exibição e as preferências são salvos em `auth.user_metadata` pelo Supabase Auth.
- No modo demonstração, nome e preferências são armazenados no `localStorage` do navegador.
- A alteração de e-mail utiliza o fluxo de confirmação do Supabase Auth; a troca de senha utiliza `auth.updateUser`.
- A preferência de alerta de validade (3, 7 ou 15 dias) é aplicada no Dashboard e na Despensa.
- A unidade-base padrão (unidade, gramas ou mililitros) é sugerida ao abrir o cadastro de um novo produto.
- A seção Residência reutiliza o módulo existente de convites e compartilhamento para contas conectadas.

## O que ainda não está disponível

- Exclusão de conta: requer fluxo server-side e página pública, a serem entregues antes da publicação nas lojas.
- Exportação dos dados da residência: pendente.
- Notificações push: não habilitadas nesta sprint.
- Tema escuro: não implementado.
- Preferências locais do modo demonstração não são sincronizadas com outros dispositivos.

## Como atualizar no Windows

1. Pare o servidor local com `Ctrl + C`.
2. Extraia esta versão do projeto em uma pasta nova ou substitua os arquivos existentes, preservando seu `.env.local`.
3. Abra a pasta que contém `package.json` no VS Code.
4. Execute `npm.cmd install`.
5. Execute `npm.cmd run typecheck` e `npm.cmd run build`.
6. Execute `npm.cmd run dev` e abra `http://localhost:5173/configuracoes`.

## Validação

O código TS/TSX foi analisado sintaticamente com o compilador TypeScript global disponível no ambiente. O `typecheck` e o build completo não puderam ser concluídos neste ambiente porque as dependências npm não estavam instaladas e a tentativa de instalação expirou. Devem ser executados no Windows após `npm.cmd install`.
