import type { MetadataRoute } from 'next'

// App privado da família: nenhum robô (busca, IA, raspagem) deve rastrear nada.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
