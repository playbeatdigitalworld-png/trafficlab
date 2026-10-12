/**
 * Domain guard — validates user-supplied targets for the traffic engine.
 *
 * Only public, resolvable-looking domains / public IP literals are accepted.
 * Loopback, private, link-local and metadata ranges are rejected so the tool
 * can only be pointed at public websites (test only sites you own or are
 * authorized to test).
 */

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

const PRIVATE_IP4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|192\.0\.0\.|198\.18\.|198\.19\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

export interface DomainCheck {
  ok: boolean
  domain?: string
  error?: string
}

export function checkDomain(input: string): DomainCheck {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, error: 'Domain is required.' }
  if (raw.length > 253) return { ok: false, error: 'Domain is too long (max 253 chars).' }

  // Accept full URLs and extract the host
  let host = raw
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.includes('/')) {
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
      host = u.hostname.toLowerCase()
    } catch {
      return { ok: false, error: 'Not a valid URL.' }
    }
  }
  host = host.toLowerCase().split(':')[0].split('?')[0].split('#')[0].trim()
  if (host.endsWith('.')) host = host.slice(0, -1)

  if (!host) return { ok: false, error: 'Domain is required.' }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home'))
    return { ok: false, error: 'Local/internal hostnames are not allowed.' }
  if (host.endsWith('.onion'))
    return { ok: false, error: 'Tor hidden services are not allowed.' }
  if (!host.includes('.') )
    return { ok: false, error: 'Enter a valid public domain (e.g. example.com).' }

  // IP literal checks
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (PRIVATE_IP4.test(host))
      return { ok: false, error: 'Private / reserved IP ranges are not allowed.' }
    return { ok: true, domain: host }
  }
  if (host.includes(':')) return { ok: false, error: 'Raw IP literals with ports are not supported — enter a domain.' }

  if (!HOSTNAME_RE.test(host))
    return { ok: false, error: 'Enter a valid public domain (e.g. example.com).' }

  return { ok: true, domain: host }
}
