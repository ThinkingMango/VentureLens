import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";

export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
export function sourceUrl(value: string): URL {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && url.port !== (url.protocol === "https:" ? "443" : "80"))) throw new Error("UNSAFE_SOURCE");
  if (!url.hostname.includes(".") || /(?:^|\.)(localhost|local|internal|test|invalid|example|onion)\.?$/i.test(url.hostname) || url.hostname.includes(":")) throw new Error("UNSAFE_SOURCE");
  url.hash = "";
  return url;
}
/**
 * Decodes a fetched page in its declared character set: the Content-Type header first, then a <meta charset> or
 * http-equiv declaration in the first 2 KB, otherwise UTF-8. Many Chinese, Japanese and Korean sites still serve
 * GBK, Big5, Shift_JIS or EUC-KR; read as UTF-8 their text is garbled, quotes cannot be matched, and the evidence is
 * silently dropped.
 */
export function decodeHtml(body: Buffer, contentType: string | undefined): string {
  const declared = (text: string | undefined) => /charset\s*=\s*["']?([\w.:-]+)/i.exec(text ?? "")?.[1]?.toLowerCase();
  const head = body.subarray(0, 2048).toString("latin1");
  const label = declared(contentType) ?? declared(/<meta[^>]+charset[^>]*>/i.exec(head)?.[0]) ?? "utf-8";
  try {
    // GB2312 pages routinely contain GBK characters; GB18030 is the superset that decodes all of them.
    return new TextDecoder(label === "gb2312" || label === "gbk" ? "gb18030" : label).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}
export function sourceExcerpt(html: string) {
  const $ = load(html);
  $("script,style,noscript,nav,header,footer,form,aside,[hidden],[aria-hidden='true']").remove();
  const title = $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 300);
  const content = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");
  content.find("p,h1,h2,h3,h4,li,div,section,br,td,tr").prepend(" ").append(" ");
  const excerpt = content.text().replace(/\s+/g, " ").trim().slice(0, 1800);
  if (excerpt.length < 80) throw new Error("EMPTY_SOURCE");
  return { title, excerpt };
}
export async function fetchResearchSource(value: string) {
  const signal = AbortSignal.timeout(15000);
  let url = sourceUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new Error("SOURCE_TIMEOUT"));
        else signal.addEventListener("abort", () => reject(new Error("SOURCE_TIMEOUT")), { once: true });
      }),
    ]);
    if (!addresses.length || addresses.some(result => !isPublicAddress(result.address))) throw new Error("UNSAFE_SOURCE");
    const address = addresses[0];
    const result = await new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = send(url, {
        signal, agent: false, family: address.family,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "VentureLens/1.0 (evidence research)" },
      }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
          response.destroy(); resolve({ redirect: response.headers.location }); return;
        }
        if (response.statusCode !== 200 || !/text\/html|application\/xhtml\+xml/i.test(String(response.headers["content-type"] ?? "")) || Number(response.headers["content-length"] ?? 0) > 2_000_000 || ![undefined, "identity"].includes(response.headers["content-encoding"])) {
          response.destroy(); reject(new Error("UNREADABLE_SOURCE")); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) response.destroy(new Error("SOURCE_TOO_LARGE"));
          else chunks.push(chunk);
        });
        response.on("end", () => resolve({ html: decodeHtml(Buffer.concat(chunks), String(response.headers["content-type"] ?? "")) }));
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("SOURCE_INTERRUPTED")));
      });
      req.on("error", reject);
      req.end();
    });
    if (result.redirect) { url = sourceUrl(new URL(result.redirect, url).href); continue; }
    return { url: url.href, ...sourceExcerpt(result.html!) };
  }
  throw new Error("SOURCE_REDIRECT_LIMIT");
}
