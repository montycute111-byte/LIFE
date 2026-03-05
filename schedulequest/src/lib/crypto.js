function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(input) {
  const normalized = String(input ?? "");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}
