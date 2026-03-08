export default async (request, context) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      }
    });
  }

  if (!target) {
    return new Response("Missing ?url= param", { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(target);
    new URL(targetUrl); // validate
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "ReactNativeVideo/9.3.0 (Linux;Android 13) AndroidXMedia3/1.6.1",
        "Referer":    "https://fancode.com/",
        "Origin":     "https://fancode.com",
        "Accept":     "*/*",
      }
    });

    const isPlaylist = targetUrl.includes(".m3u8");

    if (isPlaylist) {
      let text = await upstream.text();

      // Get base URL for relative paths
      const base = new URL(targetUrl);
      const basePath = base.origin + base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);

      // Rewrite absolute https:// URLs
      text = text.replace(/(https:\/\/[^\s\r\n"]+)/g, (match) =>
        `/proxy?url=${encodeURIComponent(match)}`
      );

      // Rewrite relative URLs (like 240p.m3u8 or seg001.ts)
      text = text.replace(/^([^#\r\n][^\r\n]*)$/gm, (line) => {
        if (line.startsWith("http") || line.startsWith("/proxy")) return line;
        return `/proxy?url=${encodeURIComponent(basePath + line)}`;
      });

      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type":                "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control":               "no-store",
        }
      });
    }

    // Binary segments (.ts, .aac, etc.)
    const contentType = upstream.headers.get("content-type") || "video/mp2t";
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":                contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "no-store",
      }
    });

  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 502 });
  }
};

export const config = { path: "/proxy" };
