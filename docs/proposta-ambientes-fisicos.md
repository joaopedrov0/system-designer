# Proposta: ambientes físicos e de infraestrutura

> Status: **proposta + fase 1 implementada** (issue #6). As fases 2 e 3 ficam para issues
> próprias, listadas no fim. Tudo é opcional: um cenário que só descreve a arquitetura lógica
> não muda em nada.

## 1. Princípios

1. **Complexidade progressiva.** Nenhum campo novo é obrigatório e nada aparece na interface
   até ser pedido: "Roda em" só existe se há um host no cenário; "Réplicas" é um link discreto;
   hardware e sensor só aparecem nos tipos que os usam.
2. **Reaproveitar o que existe.** Novos tipos entram no catálogo (`componentCatalog`); o que
   é lista de itens com id continua em `details`; o resto vira campo opcional do componente.
3. **Servir à simulação.** Os campos escolhidos são os que uma conta de capacidade, banda,
   armazenamento ou custo precisa (`docs/pesquisa-metricas-simulacao.md` entra num commit
   próprio). A fase 1 já faz a conta de banda e armazenamento dos sensores.
4. **Sem migração.** Todos os campos são novos e opcionais; `schemaVersion` continua 1 e
   `schema/scenario.schema.json` é só regenerado.

## 2. Decisões de modelagem

### 2.1 Novos tipos de componente

| Tipo (`kind`) | Rótulo                 | Para quê                                                       |
| ------------- | ---------------------- | -------------------------------------------------------------- |
| `host`        | Host / servidor físico | bare-metal, servidor on-premise, homelab                       |
| `vm`          | Máquina virtual        | VM sobre um host                                               |
| `edge-device` | Dispositivo de borda   | Raspberry Pi, gateway IoT, NVR                                 |
| `sensor`      | Sensor / câmera        | câmera, termômetro, radar, genérico (subtipo em `sensor.type`) |

`host`, `vm` e `edge-device` formam `HOST_KINDS`: são os únicos que podem hospedar outros
componentes.

**Alternativa descartada: um tipo por sensor** (`camera`, `thermometer`, `radar`...).
Multiplicaria itens na paleta e no catálogo por uma diferença que é só de atributos.
Um `sensor` com `sensor.type` mantém a paleta enxuta; se mais tarde fizer falta, o ícone
pode variar pelo subtipo sem mudar o modelo.

**Alternativa descartada: rack, datacenter e rede/VLAN como componentes.** São fronteiras,
não coisas que rodam; o modelo já tem **grupos** aninháveis para isso (ver 2.3).

### 2.2 Atributos opcionais

```ts
// Componente (src/core/schema.ts)
hostId?: string                       // onde roda
replicas?: { min: number; max?: number; ephemeral?: boolean }
hardware?: {                          // host / vm / edge-device
  cpuCores?: number; memoryGb?: number; diskGb?: number; gpu?: string
  os?: string; location?: string; address?: string; powerWatts?: number
}
sensor?: {                            // sensor
  type: 'camera' | 'environmental' | 'radar' | 'generic'
  resolution?: string; fps?: number; bitrateMbps?: number; codec?: string  // câmera
  sampleHz?: number; detectionsPerSecond?: number; readingBytes?: number   // demais
}
```

Estes campos ficam **no componente, não em `details`**: `details` guarda listas de itens
(rotas, tabelas...) que a interface renderiza como seções e que conexões referenciam por
`uses`. Hardware e sensor são um objeto só, sem id.

### 2.3 "Onde roda": referência `hostId` (escolhida)

Três opções foram comparadas:

| Opção                                                        | Legibilidade                                               | Esforço | Problemas                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `hostId` no componente** (escolhida)                    | boa: o nó mostra "em Servidor 1"; o resumo lista a relação | baixo   | não desenha uma fronteira                                                                                                                |
| B. Host como grupo (aninhamento visual)                      | ótima para poucos serviços                                 | médio   | um componente só pode estar num grupo, que já serve a "rede privada", "serviços de terceiros"; host e rede disputariam o mesmo `groupId` |
| C. Visão de implantação separada (deployment diagram UML/C4) | a melhor para infraestrutura grande                        | alto    | duplica o cenário, dois modelos para manter sincronizados                                                                                |

Escolha: **A na fase 1**, que dá relação validável ("serviço apontando para um host
inexistente") e dado para a simulação (soma de serviços por host) sem custo de interface.
O **grupo continua livre** para o que ele já faz (redes, fronteiras), e a fase 2 pode
**desenhar** a relação `hostId` como fronteira automática, sem mudar o dado. A opção C
só vale se os cenários de infraestrutura crescerem a ponto de a visão lógica atrapalhar;
fica como pergunta em aberto.

`hostId` aceita só `HOST_KINDS`, recusa ciclo (uma VM não pode hospedar seu próprio host) e,
ao remover um host, quem rodava nele fica sem host (como já acontece com `groupId`).

### 2.4 Réplicas e contêineres efêmeros

- `replicas: { min, max?, ephemeral? }`.
- **Visual:** nó empilhado (sombras deslocadas, como um baralho) quando há mais de uma cópia
  possível, selo `×3` ou `×2–10`, e **borda tracejada** se `ephemeral`.
- **Conexões:** continuam sendo **uma linha só** até o conjunto, porque a réplica não é um
  nó do cenário; é um atributo do componente. Isso mantém o diagrama legível e a conta de
  capacidade simples (capacidade × `min`/`max`).
- `max < min` é erro (comando e validação).
- Imagem, tag e limites de recursos (requests/limits) ficam para a fase 2: entram como
  campos opcionais de `replicas` ou de um `container`, sem mudar o que já existe.

**Alternativa descartada: um nó por réplica.** Dispara o tamanho do diagrama (20 câmeras =
20 nós e 20 linhas) e não representa o que nasce e morre.

### 2.5 Protocolos novos

Entram na fase 1: `mqtt`, `rtsp`, `udp`, `modbus`, `opcua`, `coap`, `serial`. Ficam para a
fase 2: BLE, Zigbee e LoRaWAN (e ONVIF, que é uma camada sobre HTTP/SOAP e RTSP). Os
rótulos estão em `protocolLabels`. Conexões existentes não mudam.

### 2.6 Sensores e estimativa de carga

Para estimar, o sistema precisa de um número por sensor: **banda**.

- Câmera: `bitrateMbps`.
- Ambiental: `sampleHz × readingBytes × 8 / 1e6`.
- Radar: `detectionsPerSecond × readingBytes × 8 / 1e6`.
- Armazenamento por dia: `Mbps × 86 400 / 8 / 1000` GB (decimal), se tudo for gravado.

`src/core/sizing.ts` (`sensorLoad`, `scenarioLoad`) faz a conta e `replicas.min` multiplica:
**20 câmeras de 4 Mbps** (`replicas: {min: 20}`) dão **80 Mbps** e **864 GB/dia**, o exemplo
da issue. O resumo em Markdown ganha a seção "Carga estimada dos sensores" e o painel do
sensor mostra a estimativa na hora.

### 2.7 Proxy reverso e balanceador

**Fase 2.** Em vez de um tipo novo, **especializar o `gateway` existente** com um subtipo
(`reverse-proxy`, `load-balancer`, `api-gateway`, `cdn`) e campos opcionais: roteamento
(reaproveitando `details.routes`: host/caminho → destino), terminação TLS, algoritmo de
balanceamento e health check. O balanceamento entre réplicas aparece de graça: uma conexão
do balanceador para um componente com `replicas` já significa "distribui entre as cópias".

### 2.8 Orquestradores

**Fase 2.** Não modelar cada objeto do Kubernetes. Proposta: **cluster** e **namespace**
como **grupos especializados** (um campo `kind` opcional no grupo: `cluster`, `namespace`,
`network`, `rack`, `site`), mais o nó replicado (2.4) para Deployment/StatefulSet/DaemonSet
(`workload`: `deployment | statefulset | daemonset | job | cronjob` em `replicas`). Service
e Ingress são conexões e um `gateway`. Importar de `docker-compose.yml` e de manifests
Kubernetes é um **comando do núcleo** (`importCompose`, `importManifests`), exposto no MCP e
na CLI, que cria componentes, grupos, `hostId`/`replicas` e conexões a partir de `depends_on`,
`ports` e `Service`.

## 3. Esboços

### Visão do cenário

```text
   ┌ Site: casa ────────────────────────────────────────────┐
   │                                                        │
   │  [Câmeras ×20] ──RTSP──▶ [NVR]       em: Servidor 1    │
   │   1080p · 4 Mbps          edge       ┌────────────┐    │
   │   ≈ 80 Mbps · 864 GB/dia             │ API  ×2–10 │    │
   │                          ──MQTT──▶   │ em Servid. │    │
   │  [Jobs ┄┄ ×1–5]  (tracejado = efêmero)└────────────┘    │
   └────────────────────────────────────────────────────────┘
```

### Resumo em Markdown

```text
### API
- **Tipo:** Servidor
- **Roda em:** Servidor 1 (`servidor-1`)
- **Réplicas:** 2–10

### Servidor 1
- **Hardware:** 16 núcleos, 64 GB de RAM, local: rack 2

## Carga estimada dos sensores
- 20 sensor(es) somados: **80 Mbps** de banda e **864 GB por dia** se tudo for gravado.
```

## 4. Integração com o resto do sistema

| Área             | Fase 1 (feito)                                                                                                | Depois                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Núcleo           | tipos, campos, protocolos, comandos com validação                                                             | gateway especializado, grupos com `kind`                                        |
| Validação        | host inexistente / tipo errado / ciclo; réplicas com `max < min`; sensor que não envia dados                  | host sobrecarregado (soma dos serviços), sensor sem consumidor de armazenamento |
| MCP              | `add_component` e `update_component` aceitam `hostId`, `replicas`, `hardware`, `sensor` (`null` remove)       | importar compose/manifests; `describe_capacity`                                 |
| Exportação       | Markdown (host, réplicas, hardware, sensor, carga) e Mermaid (formas dos novos tipos); JSON Schema regenerado | Mermaid com subgraph por host                                                   |
| Interface        | paleta, painel (Roda em, Réplicas, Hardware, Sensor), nó empilhado/tracejado/selo                             | fronteira desenhada para `hostId`, ícone por subtipo de sensor                  |
| Simulação        | estimativa de banda e GB/dia dos sensores                                                                     | capacidade por host, custo (próprio × nuvem), consumo                           |
| Diagrama interno | —                                                                                                             | um host/cluster pode mostrar o que roda nele (`subdiagram`)                     |

Cenários antigos abrem iguais: o teste `um cenário sem nenhum campo de infraestrutura
continua válido e igual` fixa isso.

## 5. Fases

| Fase  | Conteúdo                                                                                                                                                                                                                                                                                     | Status    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **1** | Tipos `host`, `vm`, `edge-device`, `sensor`; `hostId`; `replicas`; `hardware`; `sensor`; 7 protocolos; estimativa de banda e GB/dia; validação, MCP, Markdown/Mermaid, UI                                                                                                                    | **feita** |
| 2     | Gateway especializado (proxy reverso, balanceador, CDN) com rotas, TLS, algoritmo e health check; grupos com `kind` (cluster, namespace, rede, rack, site); fronteira automática para `hostId`; protocolos BLE/Zigbee/LoRaWAN; imagem/tag/limites; importar `docker-compose.yml` e manifests | a abrir   |
| 3     | Capacidade e custo: soma de serviços por host contra `hardware`, energia/amortização contra nuvem, réplicas multiplicando capacidade; diagrama interno de host/cluster                                                                                                                       | a abrir   |

## 6. Perguntas em aberto para o dono

1. **`hostId` ou visão de implantação separada?** _Recomendação:_ ficar com `hostId` e a
   fronteira automática da fase 2; só abrir a visão separada (C4/UML) se aparecerem cenários
   com dezenas de hosts.
2. **O selo e a pilha devem aparecer para `replicas: {min: 1}`?** Hoje não: só quando
   `max ?? min > 1`. O selo aparece sempre que `replicas` existe, para que `×1` seja
   um indicador explícito de "tem ciclo de vida declarado".
3. **`replicas.min` ou um valor "atual" para a conta?** _Recomendação:_ a simulação usa
   `min` e `max` como piso e teto; um campo `current` só se houver caso de uso.
4. **O Raspberry Pi é `edge-device` ou `host`?** _Recomendação:_ `edge-device`, e `host`
   fica para o que roda serviços de uso geral. A diferença é só semântica e de ícone.
5. **Tipos de sensor: mais subtipos?** _Recomendação:_ não até haver demanda (`generic`
   cobre o resto, com `bitrateMbps` ou taxa e bytes).
6. **Armazenar "tudo gravado" é o padrão certo?** A estimativa de GB/dia assume gravação
   contínua; retenção e detecção por movimento (gravar só o que muda) mudariam o número.
   _Recomendação:_ campo `retentionDays` e `recordRatio` na fase 3.
7. **Unidades.** Banda em Mbps e armazenamento em GB decimais (1 GB = 1 000 MB), como
   ISPs e fabricantes de disco. _Recomendação:_ manter, e dizer isso na interface.
