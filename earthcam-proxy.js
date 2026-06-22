export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/live-frame") {
      let videoId = url.searchParams.get("vid") || "oDCAAfOSqvA";
      
      if (videoId.includes("v=")) {
        videoId = videoId.split("v=")[1].split("&")[0];
      }

      // FIX 1: Append a timestamp directly to the YouTube asset URL.
      // This forces YouTube's image CDN to give Cloudflare a truly fresh live stream frame.
      const targetUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault_live.jpg?_ts=${Date.now()}`;
      
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          // FIX 2: Explicitly tell Cloudflare's Edge Node Network not to store this image data
          cf: {
            cacheEverything: false,
            cacheTtl: 0
          }
        });

        if (!response.ok) {
          return new Response("Failed to fetch target live stream snapshot", { status: response.status });
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
        // FIX 3: Force the browser to treat this asset as completely volatile 
        // (no caching allowed at all, re-request instantly every frame)
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");

        return new Response(response.body, { status: 200, headers: newHeaders });
      } catch (err) {
        return new Response("Proxy Engine Error: " + err.message, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
