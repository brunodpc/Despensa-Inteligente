# Guia de instalação — Despensa Inteligente (Windows)

## 1. O que instalar antes

- **Node.js 24 LTS ou 26 LTS**: https://nodejs.org/pt/download/
- Um editor de código, recomendado: **Visual Studio Code**: https://code.visualstudio.com/
- Uma conta Supabase: https://supabase.com/dashboard

Depois de instalar o Node.js, feche e abra novamente o PowerShell ou terminal do VS Code. Confira:

```powershell
node -v
npm -v
```

O Vite 7 requer Node.js 20.19+ ou 22.12+. Use uma versão LTS atual (24 ou 26).

## 2. Baixar e abrir o projeto

1. Baixe `Despensa_Inteligente_Sprint_03_Estoque.zip`.
2. Extraia o ZIP para uma pasta simples, por exemplo `C:\Projetos\despensa-inteligente`.
3. Abra essa pasta no VS Code: **File > Open Folder**.
4. Abra o terminal integrado: **Terminal > New Terminal**.
5. Confirme que o terminal está na pasta que contém `package.json`:

```powershell
Get-ChildItem
```

Se não aparecer `package.json`, navegue até a pasta correta com `cd`.

## 3. Instalar dependências

No terminal, execute:

```powershell
npm install
```

Esse comando baixa as bibliotecas necessárias e cria `package-lock.json` localmente.

## 4. Abrir a prévia sem conectar o banco

Copie o arquivo de exemplo de ambiente:

```powershell
Copy-Item env.example .env.local
```

Deixe os valores de exemplo sem alteração para iniciar o modo de demonstração. Depois execute:

```powershell
npm run dev
```

Abra no navegador o endereço apresentado pelo Vite, normalmente:

`http://localhost:5173`

Para encerrar o servidor, volte ao terminal e pressione `Ctrl + C`.

**Atenção:** a prévia local serve para conhecer a interface. Ela utiliza dados ilustrativos e não salva, não sincroniza e não compartilha alterações.

## 5. Conectar o Supabase para salvar dados de verdade

1. Acesse https://supabase.com/dashboard e crie um projeto novo.
2. No projeto, abra **Connect** para copiar a Project URL e a Publishable key. Se necessário, encontre as chaves em **Project Settings > API Keys**.
3. Abra `.env.local` no VS Code e substitua os valores de exemplo:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

4. Salve o arquivo. Use somente a Publishable key no frontend. **Nunca coloque uma Secret key ou `service_role` em variável `VITE_`, no navegador ou no Git.**
5. No Supabase, abra **SQL Editor > New query**.
6. No projeto local, abra cada arquivo abaixo, copie todo o conteúdo e execute no SQL Editor, um por vez, nesta ordem:

   1. `supabase/migrations/202611240001_initial_schema.sql`
   2. `supabase/migrations/202611240002_household_invitations.sql`
   3. `supabase/migrations/202611240003_shared_inventory_permissions.sql`

   Aguarde o sucesso de cada migration antes de executar a próxima. Não execute novamente migrations que já foram aplicadas com sucesso.

7. No Supabase, abra **Authentication > Providers** e confirme que Email está habilitado. Durante testes, você pode ajustar a confirmação de e-mail em **Authentication > Settings**. Para produção, mantenha a confirmação habilitada.
8. Reinicie o Vite para recarregar as variáveis:

```powershell
# Pare o servidor com Ctrl+C e execute novamente:
npm run dev
```

9. Crie sua conta no aplicativo. Na primeira entrada, configure o nome da residência. Depois, abra Configurações para convidar outro membro.

## 6. Convites por e-mail

O convite por link/código pode ser utilizado sem configurar o provedor de e-mail. Para enviar e-mails de verdade, ainda é necessário configurar uma conta/domínio no Resend, adicionar os secrets no Supabase e publicar a Edge Function `send-household-invitation`. Siga `supabase/README.md`.

## 7. Verificações úteis

Antes de usar, rode:

```powershell
npm run typecheck
npm run build
```

Para continuar desenvolvendo:

```powershell
npm run dev
```

## 8. Instalar no celular como PWA

O endereço `localhost` funciona no próprio computador. Para instalar no celular e compartilhar a mesma residência, primeiro será necessário publicar o app em um endereço HTTPS. Depois, abra esse endereço no navegador do celular e use **Adicionar à tela inicial** ou **Instalar aplicativo**. Os dados ficam no Supabase; não dependem de o computador permanecer ligado.

## Problemas comuns

- **`npm` não é reconhecido:** Node.js não foi instalado corretamente ou o terminal não foi reaberto. Reinstale o Node LTS e abra outro terminal.
- **`npm install` falha:** confira internet, proxy, antivírus e tente novamente; envie o texto completo do erro antes de apagar arquivos.
- **Tela diz que não foi possível carregar a residência:** confira as três migrations e se as variáveis `.env.local` estão corretas; reinicie `npm run dev`.
- **Login abre mas não cria a residência:** confira se a primeira migration foi executada sem erro e se a conta está autenticada.
- **Convite por e-mail não chega:** o envio depende do Resend e da Edge Function configurados. Enquanto isso, use link/código.

## Segurança

Não envie a ninguém sua senha, Secret key ou `service_role`. Para pedir ajuda, compartilhe mensagens de erro sem credenciais e sem dados pessoais.


## Instalação como aplicativo Windows (versão empacotada)

A versão de desenvolvimento roda no navegador. Para gerar um instalador próprio, além do Node.js, instale Rust (`rustup` com `stable-msvc`), Microsoft C++ Build Tools (carga **Desktop development with C++**) e o WebView2 Runtime. O Tauri usa esses componentes para empacotar o frontend como aplicativo Windows.

Depois de instalar as dependências do projeto:

```powershell
npm install
npm run desktop:dev
```

Para criar os instaladores:

```powershell
npm run desktop:build
```

Os arquivos serão gerados em `src-tauri\target\release\bundle\`. A configuração prevê `.exe` (NSIS) e `.msi` (WiX). Isso ainda é um pacote de desenvolvimento não assinado; para distribuição pública, configurar assinatura de código e testar em máquinas limpas.

## Versão Android

Instale Android Studio e SDK Manager. Depois: `npx cap add android`, `npm run mobile:android:sync` e `npm run mobile:android:open`. A geração/publicação de iOS precisa ser feita em macOS com Xcode. Consulte `docs/PLANO_PUBLICACAO.md`.
