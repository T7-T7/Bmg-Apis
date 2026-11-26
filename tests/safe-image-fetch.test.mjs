import test from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGE_BYTES, isPublicAddress, validateRemoteImageUrl } from "../services/safe-image-fetch.mjs";

test("remote image fetcher caps downloads at exactly 4 MiB", () => {
  assert.equal(MAX_IMAGE_BYTES, 4 * 1024 * 1024);
});

test("public address validation rejects private, loopback, link-local and reserved ranges", () => {
  for (const address of [
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1",
    "172.16.0.1", "192.168.1.1", "192.0.2.10", "198.18.0.1",
    "198.51.100.10", "203.0.113.10", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1",
  ]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("remote image URLs must use HTTPS on port 443 without credentials or local hostnames", () => {
  assert.equal(validateRemoteImageUrl("https://images.example.com/photo.png").hostname, "images.example.com");
  for (const value of [
    "http://images.example.com/photo.png",
    "https://localhost/photo.png",
    "https://service.local/photo.png",
    "https://127.0.0.1/photo.png",
    "https://10.0.0.1/photo.png",
    "https://images.example.com:8443/photo.png",
    "https://user:pass@images.example.com/photo.png",
  ]) assert.throws(() => validateRemoteImageUrl(value), undefined, value);
});

test("PhotoRoom input and output use the shared bounded SSRF-safe fetcher", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../services/photoroom.mjs", import.meta.url), "utf8");
  assert.match(source, /fetchRemoteImage\(input\)/);
  assert.match(source, /fetchRemoteImage\(imageUrl/);
  assert.match(source, /MAX_IMAGE_BYTES/);
  assert.doesNotMatch(source, /fetch\(input,/);
  assert.doesNotMatch(source, /fetch\(imageUrl,/);
});

test("PhotoRoom does not forward Firebase credentials to untrusted output hosts", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../services/photoroom.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(isTrustedPhotoRoomHost\(imageUrl\)\) downloadHeaders\.Authorization = idToken/);
  assert.doesNotMatch(source, /fetchRemoteImage\(imageUrl,\s*\{[^}]*Authorization:\s*idToken/s);
});
