import { Component, type ReactNode } from 'react'

/**
 * Isola uma parte da interface: se ela quebrar ao renderizar, mostra um aviso no lugar em
 * vez de derrubar o app inteiro (sem isto, o React desmonta tudo e a tela fica em branco).
 */
export default class ErrorBoundary extends Component<
  { label: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="space-y-1 rounded-md bg-red-50 p-2 text-xs text-red-700">
        <p>
          {this.props.label}: erro ao exibir. O resto do app continua funcionando; recarregar a
          página costuma resolver.
        </p>
        <p className="font-mono text-[11px] break-words text-red-600">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="rounded px-1.5 py-0.5 text-red-700 underline hover:bg-red-100"
        >
          Tentar de novo
        </button>
      </div>
    )
  }
}
