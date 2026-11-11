// How the app's /api/auth proxy tells Convex who the browser is. The proxy
// (src/modules/auth/server.ts) runs on the app's server, so Convex sees that
// server's address, shared by every user. It sends the browser's address in
// CLIENT_IP_HEADER, with AUTH_PROXY_SECRET in PROXY_SECRET_HEADER; Convex
// (convex/http.ts) trusts the address only when the secret matches.

export const CLIENT_IP_HEADER = 'x-webcase-client-ip'
export const PROXY_SECRET_HEADER = 'x-webcase-proxy-secret'
