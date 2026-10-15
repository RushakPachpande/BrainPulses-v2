import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCorsOriginDelegate, isPrivateNetworkOrigin } from '../src/lib/cors-origin.js';

function allow(
  delegate: ReturnType<typeof createCorsOriginDelegate>,
  origin: string | undefined,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    delegate(origin, (err, allowed) => {
      if (err) reject(err);
      else resolve(Boolean(allowed));
    });
  });
}

describe('cors-origin', () => {
  it('recognizes localhost and RFC1918 hosts', () => {
    assert.equal(isPrivateNetworkOrigin('http://localhost:5173'), true);
    assert.equal(isPrivateNetworkOrigin('http://127.0.0.1:5174'), true);
    assert.equal(isPrivateNetworkOrigin('http://192.168.1.10:5173'), true);
    assert.equal(isPrivateNetworkOrigin('http://10.0.0.5:5174'), true);
    assert.equal(isPrivateNetworkOrigin('http://172.16.0.2:3002'), true);
    assert.equal(isPrivateNetworkOrigin('http://8.8.8.8:5173'), false);
    assert.equal(isPrivateNetworkOrigin('https://evil.example'), false);
  });

  it('allows allowlist always; LAN only outside production', async () => {
    const allowlist = 'http://localhost:5173,http://localhost:5174';
    const lan = 'http://192.168.0.42:5173';

    const dev = createCorsOriginDelegate(allowlist, 'development');
    assert.equal(await allow(dev, undefined), true);
    assert.equal(await allow(dev, 'http://localhost:5173'), true);
    assert.equal(await allow(dev, lan), true);
    assert.equal(await allow(dev, 'http://evil.example'), false);

    const prod = createCorsOriginDelegate(allowlist, 'production');
    assert.equal(await allow(prod, 'http://localhost:5173'), true);
    assert.equal(await allow(prod, lan), false);
  });
});
