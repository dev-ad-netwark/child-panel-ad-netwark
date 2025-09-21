// config.js
export async function fetchAndDecryptConfig() {
  const secret = "12345678901234567890123456789012"; // same ENC_SECRET_KEY as backend
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Backend URL (dev/prod switch)
  const BACKEND_URL = window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://ad-netwark-ad-swipe-link.onrender.com";

  // 🔹 Fetch encrypted config
  const res = await fetch(`${BACKEND_URL}/firebase-config`);
  const { encrypted, iv } = await res.json();

  // 🔹 AES-CBC decrypt
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
    key,
    Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  );

  return JSON.parse(dec.decode(decrypted));
}

