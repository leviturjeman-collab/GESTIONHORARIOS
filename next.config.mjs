/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Paquetes que deben tratarse como externos en el servidor (no bundlearlos).
    // pdf-parse usa pdfjs-dist con su propio worker: si webpack lo empaqueta se
    // rompe; externalizándolo se carga en runtime desde node_modules.
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "@anthropic-ai/sdk", "@google/generative-ai", "pdf-parse"],
    // Subir el límite del cuerpo de las Server Actions (por defecto 1 MB) para
    // permitir Excels y, sobre todo, fotos/capturas del cuadrante.
    serverActions: { bodySizeLimit: "12mb", allowedOrigins: ["localhost:3000"] },
    // Timeout del proxy en dev (por defecto 30s). Lo subimos a 300s (5 min)
    // porque el análisis OCR + Claude puede tardar 2+ minutos.
    proxyTimeout: 300_000,
  },
};

export default nextConfig;
