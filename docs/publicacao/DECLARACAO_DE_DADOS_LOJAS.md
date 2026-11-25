# Preparação dos formulários de privacidade das lojas

Não preencher os formulários da Google Play ou App Store por suposição. O responsável deve mapear a versão final e os SDKs/fornecedores efetivamente incluídos no binário.

| Grupo a investigar | Perguntas para a revisão |
|---|---|
| Identificadores e conta | E-mail, identificador de usuário, autenticação, logs de sessão são coletados? |
| Conteúdo do usuário | Produtos, listas, compras, notas e fotos são armazenados na nuvem? |
| Diagnóstico | Crash reports, métricas ou analytics estão ativos? |
| Terceiros | Supabase, Resend, OCR, scanner, telemetria ou SDKs adicionais recebem dados? |
| Segurança | Há criptografia em trânsito, controles de acesso e gestão de segredos? |
| Exclusão | É possível iniciar exclusão dentro do app e pela web? Os dados e arquivos são realmente removidos? |

**Regra:** as respostas devem cobrir todas as versões/plataformas e SDKs, não apenas o código React visível.
