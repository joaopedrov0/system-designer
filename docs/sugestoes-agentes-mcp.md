# Sugestões dos agentes para o MCP

Retorno dos agentes que mapearam projetos reais usando o servidor MCP do System Designer.
Serve de lista de pendências; marque o que for feito.

- **Teste 1** (subagente do Claude Code): mapeou `mastrien/emmas_librarian`.
- **Teste 2** (agentes do Antigravity, Gemini 3.8 Flash): mapearam `joaopedrov0/zynlib`,
  `joaopedrov0/wisdomdungeon`, `joaopedrov0/rankit` e `mastrien/arca`. Os cenários estão em
  `local/` (fora do git).

## Pendentes

- [ ] **`list_component_kinds` sem arquivo.** Hoje exige `file`, e falha se o cenário ainda
      não foi criado. É um catálogo estático do servidor; deveria funcionar sem arquivo.
      _(zynlib)_
- [ ] **`connect` aceitar `uses`.** Hoje associar rotas/tabelas a uma conexão exige um
      `update_connection` depois. _(arca)_
- [ ] **`set_component_details` gerar ids.** Exige `id` em cada rota/tabela/modelo/tópico,
      enquanto `add_detail_item` gera sozinho; ao montar uma seção inteira, o agente precisa
      inventar ids únicos. Sugestão: gerar quando faltar. _(wisdomdungeon)_
- [ ] **Variáveis de ambiente uma a uma.** `add_detail_item` não aceita `env`; a única forma
      é `set_component_details`, que substitui a lista inteira. _(rankit, 1ª tentativa)_
- [ ] **Seção de comandos para clientes.** Uma CLI (cliente) não tem onde listar seus
      comandos (como as rotas de um servidor); hoje vai para a descrição. _(arca)_
      Talvez as telas do mapa de navegação já cubram parte disso para clientes com
      interface; para CLI, uma seção `commands` faria sentido.
- [ ] **Documentar melhor o `$N` do `batch`.** Passos que não criam nada (ex.:
      `set_scenario_info`) também contam na numeração. Funciona, mas pegou um agente de
      surpresa: vale um exemplo na descrição, ou referências por nome (`"as": "api"` →
      `"$api"`). _(arca)_

## Já resolvidas

- [x] Segredos nunca guardam valor (`secret: true` descarta `value`). _(Teste 1)_
- [x] `add_detail_item` valida a seção pelo tipo do componente e o formato do item.
      _(Teste 1)_
- [x] `connect` recusa conexão duplicada. _(Teste 1)_
- [x] `auto_layout` posiciona as notas e devolve um resumo. _(Teste 1)_
- [x] Operação `batch` (tudo ou nada) e `validate_scenario`. _(Teste 1)_
- [x] Protocolos `ipc` e `file`; `description` nas variáveis de ambiente. _(Teste 1)_

## Observações de ambiente (não são do MCP)

- Na 1ª tentativa do rankit, um hook do ai-memory (`PreToolUse`) passou a falhar com
  `0xc0000142` (STATUS_DLL_INIT_FAILED) depois de o processo pai ser interrompido,
  bloqueando as últimas chamadas. A 2ª execução, sem interrupção, não teve o problema.
- Clonar repositórios dentro da pasta temporária do Claude Code estoura o limite de 260
  caracteres de caminho do Windows em repositórios com `venv` versionado; use
  `git -c core.longpaths=true clone` ou um caminho curto.
