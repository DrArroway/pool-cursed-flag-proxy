export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/live-frame") {
      // Grabs a real-time thumbnail frame from a public stream route
      const targetUrl = "https://img.youtube.com/vi/iNhVvbGBP3Q/maxresdefault.jpg";
      
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://www.earthcam.com/'
          }
        });

        if (!response.ok) {
          return new Response("Failed to fetch stream frame", { status: response.status });
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Proxy Server Error: " + err.message, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
