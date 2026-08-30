# Como contribuir — Campus Cultural (Frontend)

Guia do fluxo de trabalho do time: setup, branch, código, checagens e Pull Request.

O ciclo do dia a dia é sempre o mesmo:

```
main atualizada → branch → código → checagens locais → commit → push → PR → review + CI → merge
```

> **O projeto usa uma branch só: `main`.** Não existe branch `develop`. Todo trabalho sai de
> `main` em uma branch curta e volta para `main` por Pull Request. O que protege a `main` não é
> uma branch intermediária: é a **branch protection** do GitHub exigindo Pull Request e CI verde
> antes do merge.

---

## Antes de tudo: são dois repositórios

| Repositório | O que tem lá |
|-------------|--------------|
| [Frontend](https://github.com/Campus-Cultural-2/Frontend) | O app. Expo, React Native e todas as telas. |
| [Backend](https://github.com/Campus-Cultural-2/Backend) | A API. Python, FastAPI, banco de dados e todas as regras de negócio. |

São repositórios separados, com históricos, branches e Pull Requests separados. A maioria das
tarefas mexe em só um. Uma tarefa que mexe nos dois precisa de **dois Pull Requests**, e eles
devem ser mergeados próximos um do outro para as duas metades não ficarem incompatíveis.

> **Atenção:** todo comando `git` vale para a pasta em que você está. Rodar `git status` na
> pasta errada é a maior fonte de confusão quando se trabalha nos dois repositórios. Na dúvida,
> confirme com `git branch --show-current`.

---

## Parte 1 — Setup inicial

Feito uma vez por máquina. Pré-requisito: Node 20 ou superior.

```bash
git clone https://github.com/Campus-Cultural-2/Frontend.git
cd Frontend
npm install
cp .env.example .env
npm start
```

Depois: `a` (Android), `i` (iOS) ou `w` (web).

O [`README.md`](README.md) tem o detalhe de cada plataforma, incluindo emulador Android e
celular físico.

### Sobre o `.env` — o passo que mais dá problema

- `.env.example` **é versionado** e tem valores de exemplo. Ele documenta quais variáveis existem.
- `.env` **nunca é versionado** (está no `.gitignore`) e tem os seus valores reais.

**Aqui o `.env` é obrigatório.** Sem `EXPO_PUBLIC_API_URL`, o app quebra ao iniciar — o
[`src/lib/config/env.ts`](src/lib/config/env.ts) lança erro de propósito, porque não existe
padrão razoável para "onde está o servidor". É melhor quebrar alto do que adivinhar errado em
silêncio.

> No backend é o contrário: lá o `.env` é opcional, porque toda configuração tem um padrão
> seguro de desenvolvimento.

Aponte a variável para a API que você vai usar:

| Onde você roda | Valor no `.env` |
|----------------|-----------------|
| Web ou iOS Simulator, backend na mesma máquina | `http://127.0.0.1:8000` |
| Android Emulator, backend na máquina host | `http://10.0.2.2:8000` |
| Celular físico, mesma Wi-Fi | `http://<IP-do-PC>:8000` |
| API publicada | a URL pública do backend |

Sem barra no final. Depois de mudar o `.env`, reinicie com `npm run start:clear` — o valor é
embutido no bundle, então o Metro precisa recompilar.

> **Nunca commite um segredo de verdade.** E lembre que tudo que começa com `EXPO_PUBLIC_` fica
> **visível dentro do app** — não coloque nada sensível ali. Segredo de verdade fica no backend
> ou nos secrets do EAS/CI.

---

## Parte 2 — O ciclo do dia a dia

### 1. Comece de uma `main` atualizada

Sempre. Criar branch a partir de uma `main` desatualizada é o que gera conflito chato depois.

```bash
git checkout main
git pull
```

### 2. Crie uma branch para a sua tarefa

Uma branch por tarefa. Mantenha pequena — uma branch que mexe em trinta arquivos é impossível de
revisar, e o revisor vai ou aprovar sem ler ou deixar parada por uma semana.

```bash
git checkout -b feat/inscricao-em-evento
```

### 3. Escreva o código

Siga o que já está documentado no repositório:

- [`README.md`](README.md) — setup, configuração da API, scripts e build.
- [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md) — convenções: toda chamada HTTP passa por
  `src/lib/api`, sem `any`, sem `console.log` em código de produção, token só em
  `src/lib/auth/token.ts`.

### 4. Rode as checagens localmente — antes do push

São as mesmas checagens que o CI vai rodar.

```bash
npm run check         # typecheck (TypeScript) + ESLint
npm run export:web    # confirma que o build web ainda funciona
```

### 5. Faça o commit no padrão do time

Veja a Parte 3 para os prefixos. Escreva no imperativo e diga **o que mudou**.

```bash
git add .
git commit -m "feat: adiciona inscricao em evento"
```

### 6. Envie a branch

O primeiro push de uma branch nova precisa do `-u` para ligá-la ao remoto. Depois disso, só
`git push`.

```bash
git push -u origin feat/inscricao-em-evento
```

### 7. Abra o Pull Request com destino a `main`

O GitHub mostra um botão "Compare & pull request" depois do push.

Na descrição, diga o que mudou, por quê, e como o revisor pode testar. Se mexeu em tela, um print
ou um vídeo curto ajuda muito.

### 8. Espere o CI e peça review

Se ficar vermelho, corrija e faça push de novo — o mesmo Pull Request se atualiza sozinho, não
precisa abrir outro.

Depois um colega revisa. Comentários são sobre o código, não sobre você.

### 9. Faça o merge e limpe

Com o CI verde e o review aprovado, faça o merge em `main`. Depois apague a branch (o GitHub
oferece um botão) e limpe a sua máquina:

```bash
git checkout main
git pull
git branch -d feat/inscricao-em-evento
```

---

## Parte 3 — Convenções de nome

O time já usa isso na maior parte dos commits. O valor está em usar **de forma consistente**,
para o histórico continuar legível daqui a um ano.

### Mensagens de commit — Conventional Commits

Formato: `tipo: descrição curta em minúsculas`

| Prefixo | Use para | Exemplo |
|---------|----------|---------|
| `feat:` | funcionalidade nova que o usuário percebe | `feat: adiciona tela de perfil` |
| `fix:` | correção de bug | `fix: corrige data invalida no calendario` |
| `refactor:` | reorganização sem mudar comportamento | `refactor: organiza camada de api` |
| `test:` | só testes | `test: cobre fluxo de login` |
| `docs:` | só documentação | `docs: atualiza README de setup` |
| `chore:` | ferramentas, configuração, dependências | `chore: atualiza expo para sdk 54` |

### Nomes de branch

Formato: `tipo/descricao-curta-com-hifens`, com os mesmos prefixos acima.

| Bom | Evite |
|-----|-------|
| `feat/inscricao-em-evento` | `dev_calendario` — underline, sem tipo |
| `fix/refatora-arquitetura` | `tela-Login` — maiúscula, sem tipo |
| `chore/atualiza-dependencias` | `teste` — não diz nada |

### Idioma

A convenção do projeto, registrada no `docs/CODE_STYLE.md`: **código e identificadores em inglês,
texto para o usuário final e descrição de commit em pt-BR.**

---

## Parte 4 — O que o CI verifica

O CI é uma máquina limpa que clona a sua branch, instala tudo do zero e roda as checagens. Ele
prova que o seu código funciona em outro lugar além da sua máquina.

| Verifica | Reproduza localmente com |
|----------|--------------------------|
| Typecheck (TypeScript) | `npm run typecheck` |
| Lint (ESLint) | `npm run lint` |

Os dois juntos são o `npm run check`. No CI eles são passos separados, para o GitHub mostrar
qual dos dois quebrou.

### O projeto usa npm

Instale sempre com `npm install`, nunca com `pnpm` ou `yarn`. Um segundo lockfile no
repositório faz cada pessoa instalar versões diferentes das dependências, e aí "na minha
máquina funciona" vira um problema de verdade. O CI roda `npm ci`, que instala exatamente o que
está no `package-lock.json`.

### Quando o CI ficar vermelho

**Reproduza localmente com o mesmo comando.** Leia o log: abra o passo que falhou na aba
*Actions* do GitHub e procure o **primeiro** erro, não o último. Erros se acumulam em cascata; o
primeiro costuma ser o de verdade.

Causas mais comuns:

- **Erro de tipo** que o seu editor não mostrou porque o arquivo estava fechado.
- **"Na minha máquina funciona"** — normalmente um arquivo que você esqueceu de commitar, ou uma
  dependência instalada localmente e não adicionada ao `package.json`.

> **Nunca faça merge de um Pull Request vermelho.** Se uma checagem parece errada, conserte a
> checagem — não passe por cima dela. Um CI que todo mundo ignora é pior que não ter CI, porque
> parece proteção sem proteger nada.

---

## Parte 5 — Revisão de código

**Como autor:**

- Mantenha o PR pequeno e focado em uma coisa só.
- Explique o **porquê**; o diff já mostra o quê.
- Print ou vídeo curto para qualquer mudança de tela.
- Responda todos os comentários, mesmo que seja só "feito".
- Envie correções como commits novos. Não faça force-push no meio da revisão — isso apaga o
  ponto onde o revisor estava.

**Como revisor:**

- Revise no mesmo dia. PR parado apodrece e acumula conflito.
- Separe "isso está quebrado" de "eu teria feito diferente".
- Baixe a branch e rode de verdade quando a mudança não for trivial.
- Aprove quando estiver bom o suficiente, não quando estiver perfeito.

---

## Parte 6 — Chegando em produção

**`main` é a única branch de longa duração, e ela deve estar sempre funcionando.** Todo Pull
Request mergeado entra nela.

Os builds de APK e de produção saem do `eas.json` e são disparados a partir da `main` — veja a
seção de build no [`README.md`](README.md).

> **Não publique numa sexta à tarde.** Não é superstição: se quebrar, quem sabe consertar já foi
> embora. Publique quando o time estiver por perto.

---

## Parte 7 — Problemas comuns

### "Network request failed" / API não responde

1. Teste a API direto: `curl $EXPO_PUBLIC_API_URL/health` — esperado `{"status":"ok"}`.
2. Confira que a URL não tem barra no final e reinicie com `npm run start:clear`.
3. No Android Emulator com backend local, use `http://10.0.2.2:8000` — **não** `127.0.0.1`, que
   significa o próprio emulador.
4. No celular físico, use o IP da sua máquina na rede e confirme que os dois estão na mesma Wi-Fi.

### Erro de CORS no console do navegador

Só afeta o build web. A configuração `CORS_ORIGINS` do backend precisa incluir a origem de onde o
navegador está chamando — `http://localhost:8081` no Expo web. Localmente o backend libera tudo
por padrão, então isso só costuma aparecer em ambiente publicado.

### Conflito de merge

Acontece quando a sua branch e a `main` mudaram as mesmas linhas. Não é desastre:

```bash
git checkout main
git pull
git checkout sua-branch
git merge main
# resolva os conflitos marcados no editor, depois:
git add .
git commit
```

Trazer a `main` para a sua branch com frequência mantém os conflitos pequenos.

### Um diff gigante de arquivos que você não tocou

É quebra de linha — diferença entre Windows e Mac. Avise quem cuida do DevOps em vez de commitar.

---

## Onde está o resto da documentação

| Arquivo | Cobre |
|---------|-------|
| [`README.md`](README.md) | Setup, configuração da API por plataforma, scripts npm, EAS Build, problemas comuns |
| [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md) | Convenções — arquitetura, TypeScript, componentes, segurança |
| [`.env.example`](.env.example) | Variáveis de ambiente que existem |

> **Documentação envelhece.** Quando você mudar o comportamento, atualize a documentação no
> mesmo Pull Request. Documentação que mente é pior que documentação que não existe.
