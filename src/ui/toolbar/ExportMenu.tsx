import { useReactFlow } from '@xyflow/react'
import { Braces, Download, FileImage, ImageDown } from 'lucide-react'
import { slugify, toJSON } from '../../core'
import { useEditor } from '../../store/editor'
import { downloadText, exportImage } from './exporting'
import Popover, { MenuItem } from './Popover'

export default function ExportMenu() {
  const { getNodes, getNodesBounds } = useReactFlow()
  const showError = useEditor((s) => s.showError)

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
