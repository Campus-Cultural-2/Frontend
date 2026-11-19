# Padrao de Codigo e Boas Praticas

Este guia define o padrao esperado para contribuicoes no frontend.

## Arquitetura

- `app/` deve conter apenas rotas do Expo Router e wrappers pequenos.
- `src/view/screens/` deve conter telas completas.
- `src/view/hooks/` deve conter hooks usados pela camada visual.
- `components/` deve conter componentes reutilizaveis de interface.
- `src/lib/` deve conter API, storage, configuracao e utilitarios sem dependencia visual.
- `src/lib/api/campus.ts` deve ser a fachada publica da API para telas e componentes; novas chamadas devem ficar em modulos internos por dominio (`auth.ts`, `users.ts`, `events.ts`, etc.) e ser reexportadas pela fachada.
- Evite criar abstracoes antes de haver repeticao real.
- Prefira nomes descritivos em ingles para codigo e mensagens em pt-BR para usuario.

## TypeScript

- Mantenha `strict` ativo.
- Evite `any`. Quando o Expo Router exigir cast, isole o cast no ponto de navegacao.
- Modele payloads de API com tipos explicitos.
- Nao silencie erro de tipo com `as unknown as`.
- Nao exporte tipos que so sao usados dentro do proprio arquivo.

## Componentes

- Telas devem ser legiveis de cima para baixo: estado, derivacoes, handlers e JSX.
- Componentes pequenos podem ficar no mesmo arquivo da tela se nao forem reutilizados.
- Componentes reutilizados em mais de uma tela devem ir para `components/`.
- Use `accessibilityRole` e `accessibilityLabel` em botoes sem texto claro.
- Evite textos gigantes dentro de botoes; use labels curtos.

## API e Estado

- Toda chamada HTTP deve passar por `src/lib/api`.
- Nao montar URLs da API diretamente em telas.
- Nao expor detalhes sensiveis do backend em alerts.
- Validacao no frontend melhora UX, mas nao substitui validacao no backend.
- Tokens devem ficar em `src/lib/auth/token.ts`.
- Tokens expirados ou invalidos devem ser removidos antes de redirecionar o usuario.

## Variaveis de Ambiente

- Use `.env.example` para documentar variaveis.
- Nunca commite `.env`.
- `EXPO_PUBLIC_*` e publico no bundle. Nao use para segredos.
- Chaves privadas, credenciais de assinatura e tokens de servico devem ficar no backend ou em secrets do EAS/CI.

## Seguranca

- Nao registrar tokens, senhas, payloads sensiveis ou respostas completas no console.
- Nao adicionar `console.log` em codigo de producao.
- Nao armazenar senha em estado alem do necessario para submeter formulario.
- Limpar token ao sair da conta.
- Em iOS/Android, use `expo-secure-store` para tokens de usuario; nao use AsyncStorage para sessao autenticada.
- No web, `localStorage` e apenas compatibilidade do Expo Web. Antes de producao web, reavaliar estrategia com cookies seguros no backend.
- Preferir HTTPS fora do desenvolvimento local.
- Falhas de rede devem mostrar mensagens genericas e acionaveis.

## Build de Producao

- Rodar `npm run check` antes de PR.
- Rodar `npm run export:web` quando alterar rotas, assets ou configuracao.
- O bundle de producao e minificado pelo Metro/Expo.
- `metro.config.js` remove `console.*` e reduz nomes quando o minificador roda.
- Obfuscacao nao deve ser tratada como barreira de seguranca. Segredo real nunca fica no app.

## Estilo de Codigo

- Prefira funcoes puras para formatacao e validacao.
- Handlers devem ter nomes com verbo: `handleLogin`, `saveEvent`, `validateForm`.
- Constantes de regra de negocio devem ficar fora do componente.
- Evite comentarios obvios. Comente apenas decisoes nao evidentes.
- Mantenha imports organizados por origem: bibliotecas, React Native/Expo, aliases internos.

## Git

- A `main` e a unica branch de longa duracao. Nao existe `develop`.
- Todo trabalho sai da `main` em branch curta e volta por Pull Request.
- Commits devem usar tipo convencional e gitmoji:

```bash
feat: ✨ adiciona cadastro de evento
fix: 🐛 corrige validacao de login
refactor: ♻️ reorganiza camada de api
docs: 📝 atualiza guia de build
```

- PRs devem explicar:
  - o que mudou
  - como testar
  - riscos conhecidos
  - screenshots quando houver mudanca visual

## Checklist de PR

- `npm run typecheck`
- `npm run lint`
- `npm run export:web`
- Fluxo principal testado no simulador ou web
- `.env` e credenciais fora do commit
- Nenhum `console.log` ou dado sensivel em tela/log
