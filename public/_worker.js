export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Try to serve the file directly from static assets
    try {
      const asset = await env.ASSETS.fetch(request)
      if (asset.status !== 404) return asset
    } catch {}

    // For any path not found, serve index.html (SPA fallback)
    const indexRequest = new Request(new URL('/index.html', url.origin), request)
    return env.ASSETS.fetch(indexRequest)
  }
}
