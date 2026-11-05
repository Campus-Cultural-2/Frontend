<!--
Este texto aparece sozinho ao abrir uma Pull Request. Preencha e apague o
que nao se aplicar. O objetivo e que quem revisa entenda a mudanca sem
precisar perguntar.
-->

## O que muda

<!-- Uma ou duas frases. O diff mostra o que mudou; aqui diga o porque. -->

## Como testar

<!-- Em qual tela, em qual plataforma. Ex.: `npm start`, tecla `a`,
     abrir Perfil, trocar a foto. -->

## Print ou vídeo

<!-- Obrigatório para qualquer mudança visual. Antes e depois ajuda muito.
     Em texto não dá para revisar layout. -->

## Checklist

- [ ] Rodei `npm run check` localmente (typecheck + lint)
- [ ] Rodei `npm run export:web` se mexi em algo que o build web usa
- [ ] Testei no Android ou iOS, não só no web — alguns fluxos diferem
      (câmera, armazenamento do token)
- [ ] Atualizei a documentação afetada (README, CODE_STYLE, `.env.example`)

## Esta PR precisa de variável de ambiente nova?

- [ ] Não
- [ ] Sim — e já declarei em `.env.example`

> Lembre que tudo que começa com `EXPO_PUBLIC_` fica **visível dentro do
> bundle**: nunca coloque segredo ali. O valor é embutido em tempo de build,
> então mudá-lo exige um build novo, não basta reiniciar.

## Esta PR depende de alguma mudança no backend?

- [ ] Não
- [ ] Sim — link da PR do backend: <!-- cole aqui -->

> As duas precisam ser mergeadas próximas uma da outra, senão o app fica
> chamando uma API que ainda não existe, ou o contrário.
