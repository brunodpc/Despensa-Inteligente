# Instalação em celular — Android e iOS

Guia prático para sair do uso somente no PC. A ordem recomendada é **PWA → Android → iOS**, porque a PWA não exige conta de desenvolvedor e já usa o mesmo código.

## 0. Antes de começar: Supabase

Sem as variáveis do Supabase, o aplicativo abre em **prévia local**: os dados ficam apenas no `localStorage` do dispositivo e **não sincronizam** entre PC e celular, nem entre moradores.

Para usar de verdade:

1. No Supabase, abra **Project Settings → API**.
2. Copie a **Project URL** e a **Publishable key** (`sb_publishable_...`).
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Aplique as quatro migrations na ordem descrita no `README.md`.
5. Em **Authentication → URL Configuration**, adicione a URL de produção e as URLs de redirecionamento do app.

Nunca use `service_role` ou Secret key no frontend, nos workflows ou no repositório.

## 1. PWA — caminho mais rápido (Android e iOS)

1. No GitHub, abra **Settings → Pages** e escolha **GitHub Actions** como fonte.
2. Abra **Actions → PWA - publicar no GitHub Pages → Run workflow**.
3. Quando terminar, acesse `https://brunodpc.github.io/Despensa-Inteligente/`.
4. No celular:
   - **Android (Chrome):** menu → **Adicionar à tela inicial** / **Instalar app**.
   - **iPhone (Safari):** botão de compartilhar → **Adicionar à Tela de Início**.

Vantagens: não precisa de loja, assinatura ou Mac. Limitação: no iPhone, uma PWA ainda depende do Safari/Chrome e tem menos acesso a recursos nativos (câmera, notificações, arquivos) do que um app distribuído pela App Store.

## 2. Android — APK de teste

1. Abra **Actions → Android - APK de teste → Run workflow**.
2. Ao concluir, baixe o artefato `despensa-android-apk` (um arquivo `app-debug.apk` dentro do ZIP).
3. Transfira para o celular (cabo, Google Drive, WhatsApp ou e-mail) e abra o arquivo.
4. O Android pedirá permissão para instalar fontes desconhecidas — libere apenas para o app de arquivos usado.

Alternativa por cabo, com `adb`:

```powershell
adb install app-debug.apk
```

O APK de teste usa assinatura `debug`, adequada para uso pessoal. Para Google Play é necessário um AAB assinado com keystore própria (ver seção 4).

## 3. iOS — IPA para teste (sem Mac e sem conta paga)

O build é gerado em um runner macOS da GitHub Actions. Ele **não vem assinado**, porque assinar exige Apple Developer Program.

1. Abra **Actions → iOS - IPA para teste (sem assinatura) → Run workflow**.
2. Baixe o artefato `despensa-ios-ipa` (`Despensa-Inteligente.ipa`).
3. No Windows, instale o **Sideloadly** (https://sideloadly.io/) e o iTunes/Apple Devices.
4. Conecte o iPhone por USB, entre com seu **Apple ID gratuito**, selecione o IPA e clique em **Start**.
5. No iPhone: **Ajustes → Geral → VPN e Gerenciamento de Dispositivos** → confie no seu certificado de desenvolvedor.

Limitações importantes:

- Com conta gratuita, o app **expira após 7 dias** e precisa ser reinstalado/ressinado.
- O Sideloadly pode trocar o Bundle ID com um prefixo próprio; isso é esperado.
- Não é possível distribuir esse IPA na App Store.
- Para TestFlight/App Store é obrigatória a conta **Apple Developer (US$ 99/ano)** e um build assinado no Xcode ou em serviço de CI com os certificados configurados.

## 4. Publicação nas lojas (próxima etapa)

Antes de enviar, revise `docs/PLANO_PUBLICACAO.md`. Resumo do que falta:

- Confirmar o identificador definitivo (`com.despensainteligente.app` hoje é provisório; no iOS não pode mudar depois do primeiro envio).
- **Google Play:** conta de desenvolvedor, AAB assinado com keystore guardada fora do repositório, formulário de privacidade, política pública de privacidade e testes internos.
- **App Store:** conta Apple Developer paga, certificados/provisioning profiles, TestFlight e revisão da Apple.
- Implementar exclusão de conta dentro do app e página pública de solicitação — item obrigatório das duas lojas.
- Publicar política de privacidade, termos de uso e canal de contato.
- Ajustar descrição da loja: OCR e scanner por câmera ainda não estão implementados.

## 5. Atualizando o app

1. Alterar o código e fazer commit/push.
2. Rodar novamente o workflow desejado.
3. Android: instalar o novo APK por cima do anterior.
4. iOS: reinstalar o IPA pelo Sideloadly (renovando a assinatura).
5. PWA: a atualização é baixada automaticamente pelo service worker; talvez seja preciso fechar e reabrir o app.

## 6. Problemas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| App abre com dados de demonstração | Secrets do Supabase não configurados ou migrations não aplicadas | Verificar seção 0 |
| Android bloqueia a instalação | Instalação de fontes desconhecidas desligada | Liberar nas configurações |
| iOS mostra "app não confiável" | Certificado não foi confiado | Ajustes → Geral → VPN e Gerenciamento de Dispositivos |
| Build do iOS falha no Xcode | Mudança de versão do Xcode no runner | Fixar `macos-15` ou ajustar `IPHONEOS_DEPLOYMENT_TARGET` |
| PWA em branco no GitHub Pages | `BASE_PATH` ausente no build | Confirmar o workflow `pwa-pages.yml` |
