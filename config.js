export const fetchAndDecryptConfig = async () => {
  const secret = "12345678901234567890123456789012";
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Use environment-specific backend URL
  const BACKEND_URL = window.location.hostname === 'localhost' 
    ? "http://localhost:4000" 
    : "https://ad-netwark-child-panel-backend.onrender.com"; // Replace with your actual backend URL

  const response = await fetch(`${BACKEND_URL}/firebase-config`);
  const { encrypted, iv } = await response.json();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: ivBytes },
    key,
    encryptedBytes
  );

  const decryptedJson = dec.decode(decryptedBuffer);
  return JSON.parse(decryptedJson);
};
