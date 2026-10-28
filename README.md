# System Designer

Editor visual de arquitetura de software. Você monta um **cenário** num canvas livre:
componentes (cliente, servidor, banco de dados, fila, provedor de IA, API externa…),
conexões entre eles, grupos/fronteiras e notas.

O princípio é **complexidade progressiva**: "Cliente → Servidor" já é um cenário completo.
Rotas, tabelas, modelos de IA, tópicos, variáveis de ambiente e quais itens uma conexão usa
são detalhes opcionais, acrescentados só quando fizer sentido.

Roda inteiro no navegador, sem back-end. Os cenários ficam salvos no IndexedDB do navegador
e podem ser vinculados a um arquivo `.json` no disco, que agentes de IA editam via
[MCP ou CLI](#agentes-de-ia-mcp-e-cli).

Versão publicada: https://joaopedrov0.github.io/system-designer/

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
```

| Ação                                | Como                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Adicionar componente, grupo ou nota | arraste da barra lateral (ou clique)                                                                                                       |
| Conectar                            | arraste da borda de um componente até outro                                                                                                |
| Renomear                            | duplo clique no nó                                                                                                                         |
| Editar detalhes                     | selecione e use o painel à direita                                                                                                         |
| Colocar num grupo                   | arraste o componente para dentro do grupo                                                                                                  |
| Excluir                             | `Delete` / `Backspace`                                                                                                                     |
| Desfazer / refazer                  | `Ctrl+Z` / `Ctrl+Shift+Z` (ou `Ctrl+Y`)                                                                                                    |
| Buscar                              | caixa no canto do canvas (nome, tecnologia, rotas, tags…); `Enter` enquadra os resultados                                                  |
| Organizar                           | botão **Organizar** (auto-layout em camadas; um único passo de desfazer)                                                                   |
| Cenários                            | ícone de pasta ao lado do nome: novo, abrir, duplicar, excluir, importar JSON                                                              |
| Exportar                            | botão **Exportar**: JSON, resumo em Markdown (baixar ou copiar para colar num prompt), diagrama Mermaid, PNG ou SVG                        |
| Vincular a um arquivo               | botão **Arquivo**: grava o cenário num `.json` e sincroniza nos dois sentidos; mudanças feitas no arquivo aparecem no canvas (Chrome/Edge) |
| Visualizar fluxo                    | botão **Fluxo** ou `F`: sinais percorrem as conexões no sentido certo, em cascata a partir dos pontos de entrada (assíncronas em âmbar)    |
| Mão dupla                           | sentido **Bidirecional** no painel da conexão: desenhada como duas faixas, uma em cada sentido                                             |
| Mover a vista (caneta ou mouse)     | segure `Espaço` e arraste (como no Krita)                                                                                                  |
| Zoom com mesa digitalizadora        | segure `Ctrl+Espaço` e arraste a caneta (como no Krita): para cima/direita aproxima, para baixo/esquerda afasta                            |
| Laser                               | botão **Laser** ou `L`: desenho temporário que some sozinho (`Esc` sai)                                                                    |
| Tema                                | botão no canto direito da barra: do sistema → claro → escuro (lembrado neste navegador)                                                    |

## Scripts

| Script                            | O que faz                                                 |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | servidor de desenvolvimento                               |
| `npm run build`                   | checagem de tipos + build de produção                     |
| `npm test`                        | testes do núcleo (Vitest)                                 |
| `npm run e2e`                     | testes ponta a ponta (Playwright, usa o Chrome instalado) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                         |
| `npm run schema`                  | regenera `schema/scenario.schema.json`                    |
| `npm run mcp -- arquivo.json`     | servidor MCP (stdio) para agentes de IA                   |
| `npm run sd -- help`              | CLI com as mesmas operações do MCP                        |

## Agentes de IA (MCP e CLI)

Um agente (Claude Code, Antigravity ou outro cliente MCP) pode ler e montar cenários. Ele
edita um arquivo `.json`; com esse arquivo vinculado no editor (botão **Arquivo**), cada
mudança do agente aparece no canvas na hora, e dá para desfazer com `Ctrl+Z`.

O servidor roda o TypeScript direto, então basta ter feito `npm install` neste diretório.
Troque os caminhos pelos seus:

```bash
# Claude Code
claude mcp add system-designer -- node C:/root_lab/system-designer/bin/mcp.mjs C:/caminho/loja.json
```

```json
// Antigravity (mcp_config.json) ou outro cliente MCP
{
  "mcpServers": {
    "system-designer": {
      "command": "node",
      "args": ["C:/root_lab/system-designer/bin/mcp.mjs", "C:/caminho/loja.json"]
    }
  }
}
```

O arquivo no fim é o padrão; sem ele, cada ferramenta recebe `file`. Ferramentas:
`create_scenario`, `get_scenario` (resumo em Markdown com os ids, JSON ou Mermaid),
`list_component_kinds`, `add_component`, `update_component`, `connect`, `update_connection`,
`reverse_connection`, `add_detail_item`, `set_component_details`, `add_group`,
`update_group`, `set_group_membership`, `add_note`, `update_note`, `move_elements`,
`auto_layout`, `remove_elements`, `set_scenario_info`.

A CLI oferece as mesmas operações:

```bash
node bin/sd.mjs loja.json create "Loja"
node bin/sd.mjs loja.json add_component '{"kind":"server","name":"API","technology":"Node 22"}'
node bin/sd.mjs loja.json get_scenario
node bin/sd.mjs help connect
```

## Arquitetura

```
src/
  core/         TypeScript puro, sem React nem navegador
    schema.ts     schemas Zod: a fonte da verdade do formato (versionado)
    model.ts      tipos derivados dos schemas
    catalog.ts    tipos de componente, rótulos e seções de detalhe oferecidas
    commands.ts   TODAS as operações sobre um cenário (funções puras)
    details.ts    consulta de detalhes (rotas, tabelas…)
    search.ts     busca de componentes
    migrations.ts migração entre versões do formato
    layout.ts     auto-layout (elkjs), usado pelo botão Organizar e pelo MCP
    export/       JSON (importar/exportar com validação), JSON Schema, Markdown e Mermaid
  agent/        operações para agentes (validadas com Zod, sobre os commands)
  persistence/  ScenarioRepository (interface) + implementação IndexedDB
  store/        Zustand + histórico de undo (zundo), autosave, cenários, vínculo com arquivo
  ui/           React + React Flow: canvas, paleta, painel de propriedades, barra superior
mcp/            servidor MCP (stdio) e CLI, em Node, lendo e gravando o arquivo do cenário
bin/            pontos de entrada (`mcp.mjs`, `sd.mjs`)
```

Decisões que permitem crescer sem reescrever:

- **Modelo semântico primeiro.** O cenário é um modelo tipado; o canvas é só uma visualização.
- **Toda mutação passa por `core/commands.ts`.** São funções puras (cenário → cenário) que
  lançam `CommandError` em entradas inválidas. A UI, o servidor MCP e a CLI usam
  as mesmas funções; um back-end poderia expor a mesma API.
- **Persistência atrás de `ScenarioRepository`.** Para cliente-servidor ou desktop (Tauri),
  basta outra implementação (HTTP, sistema de arquivos).
- **Um formato só.** O que é salvo é exatamente o JSON exportado, com `schemaVersion`.

## Formato do cenário

O JSON Schema completo está em [`schema/scenario.schema.json`](schema/scenario.schema.json).
O mínimo aceito na importação:

```json
{
  "id": "loja",
  "name": "Loja",
  "createdAt": "2026-01-01",
  "updatedAt": "2026-01-01",
  "components": [
    { "id": "web", "kind": "client", "name": "Web", "layout": { "x": 0, "y": 0 } },
    { "id": "api", "kind": "server", "name": "API", "layout": { "x": 300, "y": 0 } }
  ],
  "connections": [{ "id": "web-api", "source": "web", "target": "api", "protocol": "http" }]
}
```

- `schemaVersion` ausente é tratado como a versão atual. `connections`, `groups` e `notes`
  podem ser omitidos.
- `kind`: `client`, `server`, `database`, `cache`, `queue`, `worker`, `gateway`, `storage`,
  `ai-provider`, `external-api`, `generic`.
- Coordenadas em `layout` são sempre absolutas, mesmo para componentes dentro de um grupo
  (`groupId`). Se as conexões não tiverem `layout`, as alças são escolhidas
  automaticamente. Use **Organizar** depois de importar um cenário sem posições pensadas.
- Detalhes opcionais ficam em `details` (`routes`, `entities`, `models`, `topics`, `env`,
  `notes`). Uma conexão pode listar em `uses` os ids de itens do componente de destino.
- Variáveis marcadas como `secret` nunca guardam valor.
- A importação valida a forma, migra versões antigas e rejeita referências quebradas
  (conexão para componente inexistente, ids duplicados…) com mensagens claras.
