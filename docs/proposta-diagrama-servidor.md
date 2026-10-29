# Proposta: diagrama interno de servidor

> Status: **proposta para revisão** — nada disto está implementado ainda.
> Cliente (mapa de navegação) e banco de dados (diagrama ER) já existem; ver
> `src/core/subdiagram.ts`.

## Escopo

O diagrama interno de um servidor mostra **como ele está organizado por dentro**: módulos,
em que camada cada um está e quem depende de quem. Microsserviços **não** entram aqui:
cada serviço é um componente próprio no diagrama principal, e o diagrama interno de cada um
mostra a organização daquele serviço.

## Ideia: faixas de camadas

Em vez de um canvas livre, o mini canvas é dividido em **faixas horizontais**, uma por
camada, de cima para baixo. Os nós (módulos) ficam dentro da faixa da sua camada e podem
ser arrastados lateralmente ou para outra faixa (o que muda a camada).

| Camada                | O que entra                     | Exemplos                                                           |
| --------------------- | ------------------------------- | ------------------------------------------------------------------ |
| Entrada               | Por onde o servidor é acionado  | rotas/controllers, handlers de fila, cron jobs, CLI                |
| Aplicação             | Regras de negócio, casos de uso | `CheckoutService`, `CalcularFrete`                                 |
| Domínio               | Entidades e regras puras        | `Pedido`, `Carrinho`                                               |
| Dados / integrações   | Acesso ao mundo de fora         | repositórios, clientes de APIs externas, cache, publicação em fila |
| Transversal (lateral) | Usado por todas                 | autenticação, logging, configuração                                |

As ligações são dependências dirigidas ("usa"/"chama"). Numa arquitetura em camadas elas
devem apontar **para baixo**; uma seta subindo (ex.: um repositório chamando um
controller) vira **aviso** no `validate_scenario` ("violação de camadas"). Esse é o ganho
principal em relação a desenhar à mão: o diagrama confere a regra.

## Ligação com o resto do cenário

O que torna o diagrama interno mais útil que um desenho solto:

1. **Rotas → módulo de entrada.** Cada rota já cadastrada no servidor (`details.routes`)
   pode apontar para o módulo que a atende. O inspector da rota mostra o módulo; o módulo
   mostra suas rotas.
2. **Módulo de dados → conexão de saída.** Um módulo da camada de dados pode citar as
   conexões do diagrama principal que ele usa (ex.: `PedidosRepository` → conexão
   `api-postgres`). Assim dá para responder "quem, dentro da API, fala com o Postgres?".

Os dois são opcionais (complexidade progressiva): sem eles, o diagrama continua válido.

## Modelo de dados (rascunho)

```ts
details: {
  modules?: {
    id: string
    name: string
    layer: 'entry' | 'application' | 'domain' | 'data' | 'cross'
    description?: string
    connections?: string[] // ids de conexões de saída do componente (camada de dados)
    layout?: { x: number; y: number } // x livre; y deriva da faixa
  }[]
  dependencies?: { id: string; from: string; to: string; label?: string }[]
  routes?: { /* ...como hoje... */ module?: string }[]
}
```

Segue o mesmo encaixe dos outros diagramas internos: `subdiagrams.server = { nodes:
'modules', links: 'dependencies', directed: true, ... }`, com as faixas como camada visual
a mais no `SubdiagramCanvas`. No MCP: `add_detail_item` com `section: "modules"` e
`link_items` para as dependências, como já funciona para telas e tabelas.

## Perguntas para decidir

1. **Camadas fixas ou configuráveis?** Proposta: começar com as cinco acima. Alternativa:
   predefinições ("camadas clássicas", "hexagonal" com portas e adaptadores, "MVC") ou
   faixas livres criadas pelo usuário.
2. **Violação de camadas vira aviso?** Proposta: sim, só aviso (nunca bloqueia).
3. **Ligar rotas e conexões a módulos já na primeira versão,** ou só módulos e dependências
   primeiro?
4. **Gateway e worker** também ganham este diagrama? Worker parece encaixar bem (entrada =
   consumidores de fila); gateway talvez só precise das rotas.
