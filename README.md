# System Designer

Editor visual de arquitetura de software. Você monta um **cenário** num canvas livre:
componentes (cliente, servidor, banco de dados, fila, provedor de IA, API externa…),
conexões entre eles, grupos/fronteiras e notas.

O princípio é **complexidade progressiva**: "Cliente → Servidor" já é um cenário completo.
Rotas, tabelas, modelos de IA, tópicos, variáveis de ambiente e quais itens uma conexão usa
são detalhes opcionais, acrescentados só quando fizer sentido.

Roda inteiro no navegador, sem back-end. Os cenários ficam salvos no IndexedDB do navegador.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
```

| Ação                                | Como                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Adicionar componente, grupo ou nota | arraste da barra lateral (ou clique)                                                                                                    |
| Conectar                            | arraste da borda de um componente até outro                                                                                             |
| Renomear                            | duplo clique no nó                                                                                                                      |
| Editar detalhes                     | selecione e use o painel à direita                                                                                                      |
| Colocar num grupo                   | arraste o componente para dentro do grupo                                                                                               |
| Excluir                             | `Delete` / `Backspace`                                                                                                                  |
| Desfazer / refazer                  | `Ctrl+Z` / `Ctrl+Shift+Z` (ou `Ctrl+Y`)                                                                                                 |
| Buscar                              | caixa no canto do canvas (nome, tecnologia, rotas, tags…); `Enter` enquadra os resultados                                               |
| Organizar                           | botão **Organizar** (auto-layout em camadas; um único passo de desfazer)                                                                |
| Cenários                            | ícone de pasta ao lado do nome: novo, abrir, duplicar, excluir, importar JSON                                                           |
| Exportar                            | botão **Exportar**: JSON, PNG ou SVG                                                                                                    |
| Visualizar fluxo                    | botão **Fluxo** ou `F`: sinais percorrem as conexões no sentido certo, em cascata a partir dos pontos de entrada (assíncronas em âmbar) |
| Mão dupla                           | sentido **Bidirecional** no painel da conexão: desenhada como duas faixas, uma em cada sentido                                          |
| Mover a vista (caneta ou mouse)     | segure `Espaço` e arraste (como no Krita)                                                                                               |
| Zoom com mesa digitalizadora        | segure `Ctrl+Espaço` e arraste a caneta (como no Krita): para cima/direita aproxima, para baixo/esquerda afasta                         |
| Laser                               | botão **Laser** ou `L`: desenho temporário que some sozinho (`Esc` sai)                                                                 |
| Tema                                | botão no canto direito da barra: do sistema → claro → escuro (lembrado neste navegador)                                                 |

## Scripts

| Script                            | O que faz                                                 |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | servidor de desenvolvimento                               |
| `npm run build`                   | checagem de tipos + build de produção                     |
| `npm test`                        | testes do núcleo (Vitest)                                 |
| `npm run e2e`                     | testes ponta a ponta (Playwright, usa o Chrome instalado) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                         |
| `npm run schema`                  | regenera `schema/scenario.schema.json`                    |

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
    export/       JSON (importar/exportar com validação) e JSON Schema
  persistence/  ScenarioRepository (interface) + implementação IndexedDB
  store/        Zustand + histórico de undo (zundo), autosave, ciclo de vida dos cenários
  ui/           React + React Flow: canvas, paleta, painel de propriedades, barra superior
```

Decisões que permitem crescer sem reescrever:

- **Modelo semântico primeiro.** O cenário é um modelo tipado; o canvas é só uma visualização.
- **Toda mutação passa por `core/commands.ts`.** São funções puras (cenário → cenário) que
  lançam `CommandError` em entradas inválidas. A UI as usa hoje; a mesma API pode ser exposta
  por um back-end, uma CLI ou um servidor MCP para agentes de IA.
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
