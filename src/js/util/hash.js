// SHA-256 em hexadecimal via Web Crypto (disponível no navegador e no Node
// 26 nativamente) — usado no rastreio da F4 para conferir cada arquivo do
// pacote contra o hash gravado no manifesto.
export async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
