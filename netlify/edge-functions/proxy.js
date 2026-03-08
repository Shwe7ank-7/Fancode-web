export default async (request, context) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

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
    new URL(targetUrl);
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

    // If upstream failed, return its status with body for debugging
    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response("Upstream error " + upstream.status + ": " + errText.substring(0, 300), {
        status: upstream.status,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const isPlaylist = targetUrl.includes(".m3u8");

    if (isPlaylist) {
      let text = await upstream.text();

      // Get base path for resolving relative URLs
      const base     = new URL(targetUrl);
      const basePath = base.origin + base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
      const baseQuery = base.search; // preserve query string (hdntl token)

      // Rewrite absolute https:// URLs
      text = text.replace(/(https:\/\/[^\s\r\n"]+)/g, (match) =>
        `/proxy?url=${encodeURIComponent(match)}`
      );

      // Rewrite relative segment/playlist lines (non-comment, non-empty lines)
      text = text.replace(/^([^#\r\n][^\r\n]*)$/gm, (line) => {
        line = line.trim();
        if (!line) return line;
        if (line.startsWith("/proxy")) return line;
        if (line.startsWith("http")) return `/proxy?url=${encodeURIComponent(line)}`;
        // relative path — prepend base + keep token
        const fullUrl = basePath + line + (line.includes("?") ? "" : baseQuery);
        return `/proxy?url=${encodeURIComponent(fullUrl)}`;
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

    // Binary .ts segments
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
    return new Response("Proxy fetch error: " + err.message, {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/proxy" };
