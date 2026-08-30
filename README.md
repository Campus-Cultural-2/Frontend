# Campus Cultural UTFPR — Frontend

App Expo/React Native para login, cadastro, perfil e eventos culturais da UTFPR.

| Plataforma | Uso recomendado |
|------------|-----------------|
| **Android / iOS** | Principal (emulador, dispositivo, EAS) |
| **Web** | Dev e smoke test; alguns fluxos diferem do mobile (câmera, token) |

## Começar em 3 passos

```bash
git clone https://github.com/campus-cultural/frontend.git
cd frontend
npm install
cp .env.example .env
npm start
```

No `.env`, aponte para a API que você vai usar (veja [Configurar a API](#configurar-a-api)).

Depois: `a` (Android), `i` (iOS) ou `w` (web).

## Configurar a API

Toda chamada HTTP usa `EXPO_PUBLIC_API_URL` (sem barra no final). A variável é embutida no bundle — **não** coloque segredos aqui.

### API no Render (recomendado para testar sem backend local)

```bash
EXPO_PUBLIC_API_URL=https://campus-cultural-api.onrender.com
```

| Onde roda | Funciona? | Observação |
|-----------|-----------|------------|
| **Android / iOS** (Expo Go ou build) | Sim | Basta o `.env` acima e `npm run start:clear` se já estava com outra URL |
| **Web** (`npm run web`) | Sim | O backend já libera `http://localhost:8081` na variável `CORS_ORIGINS` |

Teste rápido da API:

```bash
curl https://campus-cultural-api.onrender.com/health
# esperado: {"status":"ok"}
```

**Render (plano free):** o serviço pode “dormir”. A primeira requisição após idle pode levar ~30–60 s; login/cadastro podem parecer lentos uma vez, depois normalizam.

### Backend na sua máquina

Com o [backend](../backend) em `http://127.0.0.1:8000`:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

| Ambiente | URL no `.env` |
|----------|----------------|
| iOS Simulator ou web no mesmo Mac | `http://127.0.0.1:8000` |
| Android Emulator (API no host) | `http://10.0.2.2:8000` |
| Celular físico (mesma Wi‑Fi) | `http://<IP-do-PC>:8000` |

Após mudar o `.env`, reinicie o Metro (`Ctrl+C` e `npm start`) ou use `npm run start:clear`.

## Stack

- Expo SDK 54 · React Native 0.81 · Expo Router · TypeScript
- EAS Build (Android/iOS)
- Cliente HTTP: `fetch` em `src/lib/api/core.ts`; telas usam a fachada `src/lib/api/campus.ts` → `{EXPO_PUBLIC_API_URL}/users/...`, `/events/...`, `/health`

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm start` | Dev server (menu Expo) |
| `npm run android` / `ios` / `web` | Abre direto na plataforma |
| `npm run start:clear` | Dev com cache limpo (use após trocar `.env`) |
| `npm run check` | Typecheck + ESLint |
| `npm run export:web` | Build estático em `dist/` |
| `npm run run:android` | App nativo debug (gera `android/` se precisar) |
| `npm run build:android:preview` | APK via EAS (nuvem) |
| `npm run build:android:production` | AAB produção (EAS) |

## Desenvolvimento

```bash
npm start
```

- `a` — Android Emulator  
- `i` — iOS Simulator  
- `w` — navegador (`http://localhost:8081`)

### Web

- UI em **tema claro** (evita contraste ruim no calendário em modais brancos).
- Token em `localStorage` (menos seguro que `expo-secure-store` no mobile).
- Layout pensado para ~390–430px de largura (modo responsivo do navegador).

## Build e deploy

### Web estático

```bash
npm run export:web
npx serve dist   # opcional: testar localmente
```

No deploy do site, faça as duas coisas:

1. Defina `EXPO_PUBLIC_API_URL` com a URL da API no serviço que hospeda o site.
2. **Adicione a origem do site em `CORS_ORIGINS`**, no painel do Render do backend,
   separando por vírgula:

   ```
   CORS_ORIGINS=http://localhost:8081,https://seu-site.com
   ```

Sem o passo 2 o navegador bloqueia todas as chamadas do site para a API. É só
uma variável de ambiente: não exige alterar código nem refazer o build do app.

### Android

| Objetivo | Comando |
|----------|---------|
| Debug local | `npm run run:android` |
| Regenerar nativo | `npm run prebuild:clean -- --platform android` |
| APK testes (EAS) | `npm run build:android:preview` |
| Play Store (EAS) | `npm run build:android:production` |

Perfis em `eas.json`. Evite commitar `android/`/`ios/` sem alinhar com o time.

### iOS

```bash
npm run run:ios
```

Distribuição via EAS conforme perfis do projeto.

## Checks antes de PR

```bash
npm run check && npm run export:web
```

## Estrutura

```text
app/                         rotas (Expo Router); mantenha wrappers pequenos
src/view/screens/            telas completas por fluxo
src/view/hooks/              hooks usados pela camada visual
components/                  UI compartilhada entre telas
src/lib/api/campus.ts        fachada publica da API usada pelas telas
src/lib/api/auth.ts          endpoints de autenticacao
src/lib/api/users.ts         endpoints de usuarios e perfil
src/lib/api/events.ts        endpoints de eventos
src/lib/api/client.ts        cliente HTTP autenticado/publico
src/lib/api/core.ts          fetch, base URL e tratamento de erros HTTP
src/lib/api/session.ts       sessao, token JWT e refresh
src/lib/api/schemas.ts       schemas Zod e tipos da API
src/lib/auth/                storage de token
src/lib/config/env.ts        leitura de EXPO_PUBLIC_API_URL
src/lib/datetime/            datas e componentes auxiliares de calendario
src/lib/events/              utilitarios de eventos
src/lib/navigation/          guardas de navegacao
docs/CODE_STYLE.md           convencoes
```

## Contribuição

1. `git checkout develop && git pull`
2. Branch descritiva → código seguindo `docs/CODE_STYLE.md`
3. `npm run check && npm run export:web`
4. Commit (Conventional Commits + gitmoji) → PR para `develop`

## Problemas comuns

### “Network request failed” / API não responde

1. `curl $EXPO_PUBLIC_API_URL/health` — deve retornar `{"status":"ok"}`  
2. URL sem barra final; reinicie com `npm run start:clear`  
3. Render dormindo: espere e tente de novo  
4. Android + backend local: use `10.0.2.2`, não `127.0.0.1`

### Web: erro de CORS no console

O navegador exige `Access-Control-Allow-Origin` no backend. A origem de onde a
página está sendo servida precisa estar listada na variável `CORS_ORIGINS` do
backend, no painel do Render.

Só afeta o build web: no Android e no iOS não existe CORS.

### Calendário com datas pouco visíveis

Tema claro forçado no web; se persistir, `npm run start:clear` e recarregue a aba.

### `adb` / emulador

Configure `ANDROID_HOME` (ver [Android Studio](#android-studio-macos) abaixo).

## Android Studio (macOS)

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
```

`source ~/.zshrc` → `adb version` → Device Manager → criar AVD → `npm run android`

<details>
<summary>Windows e Linux</summary>

**Windows:** SDK em `%LOCALAPPDATA%\Android\Sdk`, variável `ANDROID_HOME`, Path com `platform-tools` e `emulator`.

**Linux:** `ANDROID_HOME=$HOME/Android/Sdk` e os mesmos paths no `PATH`. Pode precisar de KVM para o emulador.

</details>

## Identidade nativa (`app.json`)

```text
br.edu.utfpr.campuscultural
```

## Segurança

- Não commitar `.env`, keystores ou tokens.
- Autorização real no **backend**; o app só valida para UX.
- Mobile: `expo-secure-store` · Web: `localStorage`.

## Referências

- [Expo — variáveis de ambiente](https://docs.expo.dev/guides/environment-variables/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo — export web](https://docs.expo.dev/router/reference/static-rendering/)
