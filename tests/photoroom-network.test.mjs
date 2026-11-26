import test from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress, resolvePublicHttpsTarget } from "../services/photoroom.mjs";

test("Star X accepts globally routable IPv4 and IPv6 addresses", () => {
  for (const address of [
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
  ]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("Star X rejects non-public IPv4 address ranges", () => {
  for (const address of [
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("Star X rejects non-public IPv6 address ranges and mapped IPv4", () => {
  for (const address of [
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2001:0000::1",
    "2002::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("Star X rejects malformed and unsupported address families", () => {
  for (const address of ["", "localhost", "999.999.999.999", "example.com"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("Star X resolver rejects unsafe URL schemes, credentials and ports", async () => {
  const noLookup = async () => {
    throw new Error("DNS lookup must not run for invalid URL targets");
  };
  for (const value of [
    "http://example.com/image.png",
    "https://user:pass@example.com/image.png",
    "https://example.com:8443/image.png",
    "https://localhost/image.png",
    "https://service.local/image.png",
    "https://service.internal/image.png",
    "https://127.0.0.1/image.png",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/image.png",
  ]) {
    await assert.rejects(resolvePublicHttpsTarget(value, noLookup), undefined, value);
  }
});

test("Star X resolver rejects DNS names with any non-public answer", async () => {
  const mixedAnswers = async (hostname, options) => {
    assert.equal(hostname, "mixed.example");
    assert.deepEqual(options, { all: true, verbatim: true });
    return [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
  };
  await assert.rejects(
    resolvePublicHttpsTarget("https://mixed.example/image.png", mixedAnswers),
    /non-public network address/
  );
});

test("Star X resolver pins one validated DNS answer for the HTTPS request", async () => {
  let lookupCount = 0;
  const resolveHost = async (hostname, options) => {
    lookupCount += 1;
    assert.equal(hostname, "images.example");
    assert.deepEqual(options, { all: true, verbatim: true });
    return [
      { address: "8.8.8.8", family: 4 },
      { address: "1.1.1.1", family: 4 },
    ];
  };
  const target = await resolvePublicHttpsTarget("https://images.example/photo.png", resolveHost);
  assert.equal(lookupCount, 1);
  assert.equal(target.hostname, "images.example");
  assert.equal(target.address, "8.8.8.8");
  assert.equal(target.family, 4);
  assert.equal(target.url.pathname, "/photo.png");
});
