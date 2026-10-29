import { describe, expect, it } from 'vitest'
import { SUB_PORT_GAP, subdiagramPorts } from './ports'

const down = { source: 'bottom', target: 'top' }

describe('subdiagramPorts', () => {
  const positions = new Map([
    ['home', { x: 100, y: 0 }],
    ['busca', { x: 200, y: 150 }],
    ['produto', { x: 0, y: 300 }],
  ])

  it('ligações que saem pela mesma alça ganham pontas distintas, na ordem do destino', () => {
    const ports = subdiagramPorts(
      [
        { id: 'a', from: 'home', to: 'busca', sides: down },
        { id: 'b', from: 'home', to: 'produto', sides: down },
      ],
      positions,
    )
    // produto está mais à esquerda: sai pela esquerda da alça de baixo.
    expect(ports.get('b')!.source).toBe(-SUB_PORT_GAP / 2)
    expect(ports.get('a')!.source).toBe(SUB_PORT_GAP / 2)
    // Cada destino recebe uma só ligação: a ponta de chegada fica no centro.
    expect(ports.get('a')!.target).toBe(0)
  })

  it('uma ligação por alça não ganha deslocamento', () => {
    const ports = subdiagramPorts([{ id: 'a', from: 'home', to: 'busca', sides: down }], positions)
    expect(ports.size).toBe(0)
  })
})
