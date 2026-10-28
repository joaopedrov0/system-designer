import {
  Box,
  Cog,
  Database,
  Globe,
  HardDrive,
  Inbox,
  Monitor,
  Network,
  Server,
  Sparkles,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import { createElement } from 'react'

/** Mapeia o nome de ícone do catálogo (core) para o componente React. */
const icons: Record<string, LucideIcon> = {
  monitor: Monitor,
  server: Server,
  database: Database,
  zap: Zap,
  inbox: Inbox,
  cog: Cog,
  network: Network,
  'hard-drive': HardDrive,
  sparkles: Sparkles,
  globe: Globe,
  box: Box,
}

export function CatalogIcon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(icons[name] ?? Box, props)
}
