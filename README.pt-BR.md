<!-- source: README.md sha256:f25cf99b305a -->
# Nestlone

Um agente de programação de código aberto para o seu terminal — traga o seu próprio modelo.

O Nestlone começou como uma experiência nativa para o DeepSeek. Desde então,
virou um projeto guiado pela comunidade: um harness de programação que se
encaixa em uma comunidade internacional em crescimento e suporta o máximo de
modelos e provedores possível — modelos abertos primeiro, hospedados ou locais,
sem privilegiar nenhum.

Você informa um provedor, um modelo e uma tarefa. Ele lê seu código, edita
arquivos, executa comandos e verifica o próprio trabalho, e para quando a tarefa
termina ou quando precisa de você. Troque de modelo no meio da tarefa com
`/model`. Trabalhe de forma interativa na TUI, ou rode `nestlone exec` em
scripts e CI. É escrito em Rust, licenciado sob MIT, e roda na sua máquina.

Estamos sempre em busca de pessoas que contribuam e de formas de melhorar. Se um
modelo ou provedor que você usa está faltando, ou se algo quebra, nos contar é
uma das coisas mais úteis que você pode fazer — veja [Contribuindo](#contribuindo).

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [한국어](README.ko-KR.md) · [Español](README.es-419.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [codewhale.net](https://codewhale.net/) · [Docs](docs) · [Changelog](CHANGELOG.md)

[![CI](https://github.com/bdugsj/nestlone/actions/workflows/ci.yml/badge.svg)](https://github.com/bdugsj/nestlone/actions/workflows/ci.yml)
[![crates.io](https://img.shields.io/crates/v/nestlone-cli?label=crates.io)](https://crates.io/crates/nestlone-cli)
[![npm](https://img.shields.io/npm/v/nestlone?label=npm)](https://www.npmjs.com/package/nestlone)

![Nestlone rodando em um terminal](assets/screenshot.png)

## Instalação

```bash
npm install -g nestlone
```

Cargo, Docker, Nix, Scoop, arquivos pré-compilados, Android/Termux e um
espelho CNB para quem não consegue acessar o GitHub estão cobertos em
[docs/INSTALL.md](docs/INSTALL.md). Vindo do `deepseek-tui`? Sua configuração
e suas sessões são preservadas — veja [docs/REBRAND.md](docs/REBRAND.md).

## Uso

```bash
nestlone auth set --provider deepseek   # or export ANTHROPIC_API_KEY, etc.
nestlone                                # open the TUI
nestlone exec "fix the failing test"    # headless
nestlone web                            # local browser client on 127.0.0.1
```

Na TUI: `/model` troca provedor e modelo juntos, `/fleet` executa uma equipe
de workers e `/restore` desfaz um turno. Quando o compositor está ocioso, `Tab`
cicla entre Plan / Act / Operate e `Shift+Tab` cicla a postura de permissão Ask
/ Auto-Review / Full Access. `!` executa um comando de shell pelo caminho normal
de aprovação.

## O que faz

- **Qualquer modelo, qualquer provedor.** DeepSeek, Claude, GPT, Kimi, GLM e
  mais de 30 provedores, além do seu próprio vLLM, SGLang ou Ollama sem key —
  tudo por um único runtime e um único conjunto de ferramentas. Orçamentos de
  contexto e preços vêm da rota real, e um preço desconhecido aparece como
  desconhecido em vez de $0.
- **Somente leitura até você permitir mais.** O modo Plan não altera arquivos,
  e as aprovações controlam os comandos arriscados. Quando um sandbox do
  sistema operacional realmente envolve um comando, o Nestlone avisa: Seatbelt
  no macOS quando disponível, bubblewrap opcional no Linux. O
  `constitution.json` de um repositório é compilado em bloqueios de escrita
  que nem o Full Access consegue pular.
- **Trabalho que você pode retomar.** Um fleet registra cada passo em um
  livro-razão de apenas inclusão, então `fleet resume` retoma de onde você
  parou.

## Saiba mais

- [docs/PROVIDERS.md](docs/PROVIDERS.md) — cada rota de provedor: hospedada,
  gateway e local
- [docs/FLEET.md](docs/FLEET.md) — fleets, o livro-razão e resume
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — `config.toml`, hooks e a
  constitution
- [docs/HOOKS.md](docs/HOOKS.md) — os onze eventos de hook do ciclo de vida da
  TUI, seus payloads e os três que podem direcionar um turno (`nestlone exec`
  e os subcomandos da CLI não disparam hooks)
- [docs/WEB.md](docs/WEB.md) — cliente de navegador incorporado apenas em
  loopback e sua fronteira de autenticação de uso único

Todo o resto — modos, atalhos de teclado, detalhes do sandbox, MCP, a API do
runtime, arquitetura — está em [docs](docs) e em
[codewhale.net](https://codewhale.net/).

## Contribuindo

Issues, PRs, passos de reprodução, logs e pedidos de funcionalidade são trabalho
real do projeto, e primeiras contribuições são bem-vindas. Quando um PR não pode
ser mesclado como está, os mantenedores aproveitam o que funciona e o autor
continua creditado — no commit, no changelog e em
[docs/CONTRIBUTORS.md](docs/CONTRIBUTORS.md).

- [Issues abertas](https://github.com/bdugsj/nestlone/issues) — boas
  primeiras contribuições moram aqui
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup de desenvolvimento e fluxo de PR
- [docs/CONTRIBUTORS.md](docs/CONTRIBUTORS.md) — todo mundo que ajudou a
  moldar o projeto
- [Me pague um café](https://www.buymeacoffee.com/hmbown)

Obrigado à [DeepSeek](https://github.com/deepseek-ai) pelos modelos e pelo
apoio que deram início ao projeto, à
[DataWhale](https://github.com/datawhalechina) 🐋 por nos receber na família
Whale Brother, e a [OpenWarp](https://github.com/zerx-lab/warp) e
[Open Design](https://github.com/nexu-io/open-design) pela colaboração na
experiência de agente no terminal.

## Licença

[MIT](LICENSE). Projeto comunitário independente; sem afiliação com nenhum
provedor de modelos.

[![Gráfico de Star History](https://api.star-history.com/chart?repos=bdugsj/nestlone&type=date&legend=top-left)](https://www.star-history.com/?repos=bdugsj%2Fnestlone&type=date)
