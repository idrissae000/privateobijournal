import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingMessage } from "node:http";

/** True for loopback, private, link-local, CGNAT, multicast, reserved and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^(?:0{0,4}:){0,5}(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(v) ?? /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      v === "::" || v === "::1" ||
      /^f[cd]/.test(v) ||                 // fc00::/7 unique local
      /^fe[89ab]/.test(v) ||              // fe80::/10 link-local
      v.startsWith("ff") ||               // multicast
      v.startsWith("64:ff9b") ||          // NAT64
      v.startsWith("2001:db8")            // documentation
    );
  }
  return true; // not an IP at all: refuse
}

const allowLocal = () => process.env.IMAGE_IMPORT_ALLOW_LOCAL === "1"; // only ever set in automated tests

// Resolve, then refuse if ANY address is non-public. Used as the socket's own lookup, so the
// address that is validated is the address that is connected to (no DNS-rebinding gap).
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return (callback as (e: Error | null, a?: unknown, f?: number) => void)(err);
    const list = addresses as dns.LookupAddress[];
    if (!allowLocal() && list.some((a) => isPrivateAddress(a.address))) {
      return (callback as (e: Error | null) => void)(new Error("Blocked address"));
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    return (callback as unknown as (e: null, a: string, f: number) => void)(null, list[0].address, list[0].family);
  });
};

export type FetchedImage = { res: IncomingMessage; contentType: string };

/** GET a public http(s) URL (following a few redirects), safely. Caller consumes `res`. */
export function fetchPublic(rawUrl: string, redirects = 3, timeoutMs = 10000): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try { url = new URL(rawUrl); } catch { return reject(new Error("Bad URL")); }
    if (url.protocol !== "https:" && url.protocol !== "http:") return reject(new Error("Bad URL"));
    if (!allowLocal()) {
      const port = url.port || (url.protocol === "https:" ? "443" : "80");
      if (port !== "80" && port !== "443") return reject(new Error("Blocked port"));
      if (url.username || url.password) return reject(new Error("Bad URL"));
      if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
        return reject(new Error("Blocked address"));
      }
    }
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(
      url,
      {
        lookup: safeLookup,
        timeout: timeoutMs,
        headers: { "user-agent": "Mozilla/5.0 (compatible; ObisJournal/1.0)", accept: "image/*,*/*;q=0.5" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new Error("Too many redirects"));
          let next: string;
          try { next = new URL(res.headers.location, url).toString(); } catch { return reject(new Error("Bad redirect")); }
          return fetchPublic(next, redirects - 1, timeoutMs).then(resolve, reject);
        }
        if (status < 200 || status >= 300) { res.resume(); return reject(new Error(`Upstream ${status}`)); }
        resolve(res);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
  });
}
