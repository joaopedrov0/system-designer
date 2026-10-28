import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App'
import { installInputDebug } from './ui/debugInput'

// Antes de qualquer outro listener, para ver os eventos como o navegador os entrega.
installInputDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
