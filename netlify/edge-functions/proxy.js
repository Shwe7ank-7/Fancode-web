export default async (request) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url= param", { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(decodeURIComponent(target));
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Only allow FanCode CDN
  const allowed = [
    "fancode.com",
    "flive.fancode.com",
    "in-mc-flive.fancode.com",
    "bd-mc-flive.fancode.com",
    "cloudfront.net"
  ];
  const isAllowed = allowed.some(d => targetUrl.hostname.endsWith(d));
  if (!isAllowed) {
    return new Response("Forbidden domain", { status: 403 });
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: {
      "User-Agent": "ReactNativeVideo/9.3.0 (Linux;Android 13) AndroidXMedia3/1.6.1",
      "Referer":    "https://fancode.com/",
      "Origin":     "https://fancode.com",
    }
  });

  const contentType = upstream.headers.get("content-type") || "";
  const isPlaylist  = contentType.includes("mpegurl") || targetUrl.pathname.endsWith(".m3u8");

  if (isPlaylist) {
    let text = await upstream.text();
    // Rewrite all absolute https:// URLs in playlist to go through this proxy
    text = text.replace(/(https:\/\/[^\s"]+)/g, (match) =>
      `/proxy?url=${encodeURIComponent(match)}`
    );
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type":                "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "no-cache",
      }
    });
  }

  // .ts segments — pass through
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":                contentType || "video/mp2t",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "no-cache",
    }
  });
};

export const config = { path: "/proxy" };
