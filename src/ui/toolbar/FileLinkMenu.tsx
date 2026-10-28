import {
  FileJson,
  FilePlus2,
  FolderOpen,
  Link2,
  Link2Off,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { fileAccessSupported, isAbort } from '../../persistence/fileHandles'
import { useEditor } from '../../store/editor'
import { linkExistingFile, linkNewFile, reconnectFile, unlinkFile } from '../../store/fileLinks'
import { useFileLink } from '../../store/fileSync'
import Popover, { MenuItem } from './Popover'

/**
 * Vínculo do cenário com um arquivo .json no disco: o que um agente de IA (MCP/CLI) ou
 * um editor de texto mudar no arquivo aparece aqui, e vice-versa. Só no Chrome/Edge.
 */
export default function FileLinkMenu() {
  const status = useFileLink((s) => s.status)
  const showError = useEditor((s) => s.showError)
  if (!fileAccessSupported) return null

  const run = (action: () => Promise<void>, close: () => void) => {
    close()
    action().catch((err) => {
      if (!isAbort(err)) showError(err)
    })
  }

  const warning = status.kind === 'invalid' || status.kind === 'error'
  const label =
    status.kind === 'none'
      ? 'Vincular a um arquivo'
      : status.kind === 'needs-permission'
        ? `Reconectar ${status.name}`
        : status.name

  return (
    <Popover
      label={status.kind === 'none' ? 'Vincular a um arquivo' : `Arquivo vinculado: ${label}`}
      trigger={() => (
        <>
          {warning || status.kind === 'needs-permission' ? (
            <TriangleAlert size={15} className="text-amber-600" />
          ) : status.kind === 'synced' ? (
            <Link2 size={15} className="text-emerald-600" />
          ) : (
            <FileJson size={15} />
          )}
          <span className="max-w-40 truncate text-xs" data-testid="file-link-status">
            {status.kind === 'none' ? 'Arquivo' : label}
          </span>
        </>
      )}
    >
      {(close) => (
        <>
          {status.kind !== 'none' && (
            <div className="border-b border-slate-200 px-3 pt-1 pb-2 text-xs text-slate-500">
              {status.kind === 'synced' && (
                <>
                  Sincronizado com <strong className="text-slate-700">{status.name}</strong>.
                  Mudanças no arquivo aparecem aqui (e podem ser desfeitas).
                </>
              )}
              {status.kind === 'needs-permission' && (
                <>O navegador precisa de permissão de novo para usar {status.name}.</>
              )}
              {warning && (
                <span className="whitespace-pre-line text-red-600">{status.message}</span>
              )}
            </div>
          )}
          {status.kind === 'needs-permission' && (
            <MenuItem icon={<RefreshCw size={15} />} onClick={() => run(reconnectFile, close)}>
              Reconectar
            </MenuItem>
          )}
          <MenuItem
            icon={<FilePlus2 size={15} />}
            hint=".json"
            onClick={() => run(linkNewFile, close)}
          >
            Salvar em arquivo e vincular…
          </MenuItem>
          <MenuItem
            icon={<FolderOpen size={15} />}
            hint=".json"
            onClick={() => run(linkExistingFile, close)}
          >
            Abrir arquivo e vincular…
          </MenuItem>
          {status.kind !== 'none' && (
            <MenuItem icon={<Link2Off size={15} />} onClick={() => run(unlinkFile, close)}>
              Desvincular
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  )
}
