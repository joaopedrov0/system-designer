/** Operação inválida sobre um cenário (id inexistente, nome vazio, etc.). */
export class CommandError extends Error {
  name = 'CommandError'
}

/** Falha ao interpretar um cenário vindo de fora (arquivo, armazenamento, LLM). */
export class ImportError extends Error {
  name = 'ImportError'
}
