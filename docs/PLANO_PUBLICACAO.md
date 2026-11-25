# Plano de distribuição e publicação — Despensa Inteligente

**Status:** preparado para integração multiplataforma; ainda não está pronto para envio às lojas.

## 1. Canais previstos

| Plataforma | Formato | Tecnologia | Estado |
|---|---|---|---|
| Web | PWA em HTTPS | Vite PWA | Base já existente; falta hospedagem e QA de produção |
| Windows | `.exe` (NSIS) e `.msi` | Tauri 2 | Configuração inicial adicionada; falta compilar e assinar |
| Android | `.aab` para Google Play e `.apk` para testes | Capacitor 8 | Configuração adicionada; projeto nativo deve ser gerado e testado |
| iOS | Arquivo de distribuição via Xcode | Capacitor 8 | Configuração adicionada; exige macOS/Xcode e assinatura Apple |

A aplicação web continua sendo a fonte principal da interface. Capacitor reutiliza o build `dist/` em Android/iOS. Tauri reutiliza o mesmo build no Windows. Recursos nativos (câmera, scanner, notificações, compartilhamento e arquivos) deverão ser implementados por plugins e testados em cada sistema.

## 2. Identificadores de aplicativo

Identificadores configurados provisoriamente:

- Capacitor / Android / iOS: `com.despensainteligente.app`
- Tauri / Windows: `com.despensainteligente.desktop`

**Atenção:** os valores são placeholders técnicos, não uma confirmação de domínio ou titularidade. Confirmar um identificador único e estável antes de criar o registro definitivo nas lojas. O Bundle ID do App Store Connect não pode ser alterado depois que um build é enviado. Não publicar nem enviar builds de produção enquanto essa decisão não estiver fechada.

## 3. Preparar o ambiente

### Base comum

- Node.js 22 ou superior.
- Após `npm install`, versionar o `package-lock.json` gerado para builds reproduzíveis (`npm ci` em CI).
- npm.
- Dependências do projeto (`npm install`).
- Variáveis de produção do Supabase configuradas no ambiente de build.

### Windows / Tauri

- Microsoft C++ Build Tools com a carga de trabalho **Desktop development with C++**.
- Rust via `rustup`, toolchain `stable-msvc`.
- Microsoft Edge WebView2 Runtime.
- Para MSI, confirmar que o recurso opcional VBSCRIPT está habilitado.

Comandos:

```powershell
npm install
npm run desktop:dev
npm run desktop:build
```

Os instaladores serão produzidos em `src-tauri/target/release/bundle/`. A configuração solicita NSIS (`.exe`) e WiX (`.msi`). A criação de MSI deve ser executada em Windows.

Antes de distribuir publicamente, definir certificado de assinatura Authenticode, política de atualização e canal oficial para downloads.

### Android / Capacitor

- Android Studio.
- Android SDK instalado pelo SDK Manager.
- Dispositivo Android ou emulador para teste.

Comandos iniciais (depois de `npm install`):

```powershell
npx cap add android
npm run mobile:android:sync
npm run mobile:android:open
```

O Android Studio será usado para compilar e testar. Para Google Play, gerar um Android App Bundle (`.aab`), configurar assinatura de release e testar em faixas internas/fechadas antes da produção.

**Política atual da Google Play:** a partir de 31/08/2026, novos apps e atualizações devem ter target Android 16 (API 36) ou superior. Confirmar o `targetSdk` do projeto Android gerado antes de cada envio, pois a exigência pode mudar.

### iOS / Capacitor

A geração, compilação, assinatura e envio para App Store exigem macOS e Xcode. O ambiente Windows pode preparar o código web e a configuração Capacitor, mas não substitui o ambiente Apple para gerar o build final.

No Mac:

```bash
npm install
npx cap add ios
npm run mobile:ios:sync
npm run mobile:ios:open
```

No Xcode, configurar Team, Bundle Identifier, Signing e capabilities; testar em simulador e dispositivo físico; distribuir primeiro via TestFlight.

## 4. Configuração de produção

Antes do primeiro beta público:

1. Criar ambiente Supabase separado para produção (não reutilizar dados de desenvolvimento).
2. Aplicar e validar todas as migrations em ordem.
3. Configurar autenticação, URLs de redirecionamento e confirmação de e-mail.
4. Configurar o serviço de envio de e-mail e domínio remetente.
5. Definir backup, retenção, monitoramento, limites e plano de recuperação.
6. Validar RLS e testes de isolamento entre residências com contas diferentes.
7. Não incluir `service_role`, secrets ou credenciais administrativas no frontend, nos binários ou no repositório.
8. Configurar links profundos (Android App Links / iOS Universal Links) para que convites enviados por link possam abrir o aplicativo nativo; manter fallback web.
9. Configurar URLs HTTPS de produção, política de privacidade e canal de suporte.

## 5. Bloqueadores antes das lojas

Estes itens devem estar concluídos antes do primeiro envio para revisão:

- [ ] Implementar exclusão de conta dentro do app.
- [ ] Disponibilizar uma página web externa para solicitar exclusão de conta e dados associados.
- [ ] Definir como transferir ou encerrar uma residência quando o proprietário solicitar exclusão; não deixar estoque compartilhado órfão.
- [ ] Publicar política de privacidade real, revisada e acessível sem login.
- [ ] Publicar termos de uso e canal de contato/suporte.
- [ ] Completar formulários de privacidade / Data Safety com base no comportamento real e em todos os SDKs/serviços integrados.
- [ ] Validar upload e armazenamento de notas fiscais, retenção e remoção de arquivos.
- [ ] Concluir lista, modo mercado, calculadora, OCR de nota e scanner de código de barras ou remover da descrição da loja qualquer funcionalidade ainda não entregue.
- [ ] Testar acessibilidade, telas pequenas, estados vazios, erros, carregamento e conexões instáveis.
- [ ] Testar reinstalação, atualização, restauração de sessão e sincronização de dados.
- [ ] Definir identificadores definitivos, versão, screenshots, ícones, categoria, descrição e classificação etária.
- [ ] Configurar assinatura de release e guardar chaves/certificados fora do repositório.
- [ ] Executar testes beta com usuários externos e responder aos requisitos de revisão de cada loja.

## 6. Privacidade e exclusão de dados

O app cria contas e associa usuários a residências. Antes de publicar, implementar um fluxo que:

- seja acessível dentro de Configurações;
- explique o que será apagado e o que pode ser retido por obrigação legal;
- peça confirmação explícita;
- remova ou anonimize dados pessoais e trate dados compartilhados da residência sem apagar, por acidente, o histórico dos demais moradores;
- ofereça uma página externa pública para iniciar a solicitação;
- registre o resultado e informe o usuário.

O texto final da política de privacidade deve refletir o processamento efetivo: conta/e-mail, residência e membros, produtos/estoque, compras/preços, arquivos de nota quando habilitados, logs operacionais e fornecedores como Supabase e Resend. Não declarar análise, publicidade, localização ou compartilhamento de dados que não sejam usados; também não omitir qualquer SDK ou serviço que venha a ser adicionado.

## 7. Contas de desenvolvedor e custos externos

- Google Play Console: criar/verificar a conta de desenvolvedor e completar os requisitos de identidade e testes exibidos na conta.
- Apple Developer Program: adesão anual para distribuição no App Store, atualmente US$ 99/ano (ou preço local exibido pela Apple). A inscrição como organização exige validações adicionais.
- Windows: assinatura de código é recomendada para distribuição pública confiável; orçamento e certificado deverão ser escolhidos pelo responsável pelo produto.
- Hospedagem/domínio, Supabase, serviço de e-mail, assinatura de código e eventuais serviços OCR podem gerar custos próprios.

## 8. Referências oficiais

- Capacitor: https://capacitorjs.com/docs/getting-started
- Capacitor — ambiente: https://capacitorjs.com/docs/getting-started/environment-setup
- Capacitor — Google Play: https://capacitorjs.com/docs/android/deploying-to-google-play
- Capacitor — App Store: https://capacitorjs.com/docs/ios/deploying-to-app-store
- Tauri — pré-requisitos: https://v2.tauri.app/start/prerequisites/
- Tauri — instalador Windows: https://v2.tauri.app/distribute/windows-installer/
- Google Play — target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play — dados e exclusão de conta: https://support.google.com/googleplay/android-developer/answer/10144311
- Apple — diretrizes de revisão: https://developer.apple.com/app-store/review/guidelines/
- Apple — associação: https://developer.apple.com/br/programs/
