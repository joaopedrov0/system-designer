import { useReactFlow } from '@xyflow/react'
import {
  Braces,
  ClipboardCopy,
  Download,
  FileImage,
  FileText,
  ImageDown,
  Workflow,
} from 'lucide-react'
import { slugify, toJSON, toMarkdown, toMermaid } from '../../core'
import { useEditor } from '../../store/editor'
import { downloadText, exportImage } from './exporting'
import Popover, { MenuItem } from './Popover'

export default function ExportMenu() {
  const { getNodes, getNodesBounds } = useReactFlow()
  const showError = useEditor((s) => s.showError)
  const showNotice = useEditor((s) => s.showNotice)

  const fileBase = () => slugify(useEditor.getState().scenario.name)

  const image = (format: 'png' | 'svg') => {
    const nodes = getNodes()
    if (nodes.length === 0) return showError('O cenário está vazio: nada para exportar.')
    exportImage(getNodesBounds(nodes), format, `${fileBase()}.${format}`).catch(showError)
  }

  return (
    <Popover
      label="Exportar"
      align="right"
      trigger={() => (
        <>
          <Download size={16} />
          <span className="text-xs">Exportar</span>
        </>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon={<Braces size={15} />}
            hint=".json"
            onClick={() => {
              close()
              downloadText(`${fileBase()}.json`, toJSON(useEditor.getState().scenario))
            }}
          >
            Cenário (JSON)
          </MenuItem>
          <MenuItem
            icon={<FileText size={15} />}
            hint=".md"
            onClick={() => {
              close()
              const md = toMarkdown(useEditor.getState().scenario)
              downloadText(`${fileBase()}.md`, md, 'text/markdown')
            }}
          >
            Resumo (Markdown)
          </MenuItem>
          <MenuItem
            icon={<ClipboardCopy size={15} />}
            onClick={() => {
              close()
              navigator.clipboard
                .writeText(toMarkdown(useEditor.getState().scenario))
                .then(() => showNotice('Resumo em Markdown copiado.'))
                .catch(() => showError('Não foi possível copiar para a área de transferência.'))
            }}
          >
            Copiar resumo (para prompts)
          </MenuItem>
          <MenuItem
            icon={<Workflow size={15} />}
            hint=".mmd"
            onClick={() => {
              close()
              const mmd = toMermaid(useEditor.getState().scenario)
              downloadText(`${fileBase()}.mmd`, mmd, 'text/plain')
            }}
          >
            Diagrama Mermaid
          </MenuItem>
          <MenuItem
            icon={<ImageDown size={15} />}
            hint=".png"
            onClick={() => {
              close()
              image('png')
            }}
          >
            Imagem PNG
          </MenuItem>
          <MenuItem
            icon={<FileImage size={15} />}
            hint=".svg"
            onClick={() => {
              close()
              image('svg')
            }}
          >
            Imagem SVG
          </MenuItem>
        </>
      )}
    </Popover>
  )
}
