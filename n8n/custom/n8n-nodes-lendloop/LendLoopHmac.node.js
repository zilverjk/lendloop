// HMAC-SHA256 over `${t}.${rawBody}`, header `t=<unix>,v1=<hex>`, 300 s tolerance, constant-time compare.
// Must stay in sync with convex/lib/hmac.ts.
// n8n loads custom nodes as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto');

const TOLERANCE_SEC = 300;
const sign = (secret, body, t) =>
  `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const nowSec = () => Math.floor(Date.now() / 1000);

class LendLoopHmac {
  constructor() {
    this.description = {
      displayName: 'LendLoop HMAC',
      name: 'lendLoopHmac',
      icon: 'fa:lock',
      group: ['transform'],
      version: 1,
      description: 'Sign or verify LendLoop HMAC requests using a credential',
      defaults: { name: 'LendLoop HMAC' },
      inputs: ['main'],
      outputs: ['main'],
      credentials: [{ name: 'lendLoopHmacApi', required: true }],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          default: 'sign',
          options: [
            { name: 'Sign', value: 'sign', description: 'Sign a body; outputs body, signature and url' },
            { name: 'Verify', value: 'verify', description: 'Verify an incoming webhook (raw body in binary "data")' },
            { name: 'Signed Request', value: 'request', description: 'Signed GET with a fresh signature on every retry' },
          ],
        },
        {
          displayName: 'Path',
          name: 'path',
          type: 'string',
          default: '',
          displayOptions: { show: { operation: ['sign', 'request'] } },
        },
        {
          displayName: 'Body',
          name: 'body',
          type: 'string',
          default: '',
          displayOptions: { show: { operation: ['sign'] } },
        },
        {
          displayName: 'Signature Header',
          name: 'header',
          type: 'string',
          default: '',
          displayOptions: { show: { operation: ['verify'] } },
        },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const cred = await this.getCredentials('lendLoopHmacApi');
    const secret = String(cred.secret || '');
    const baseUrl = String(cred.baseUrl || '').replace(/\/+$/, '');
    if (!secret) throw new Error('LendLoop HMAC credential has no secret');
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const op = this.getNodeParameter('operation', i);
      if (op === 'sign') {
        const body = String(this.getNodeParameter('body', i));
        const path = this.getNodeParameter('path', i);
        out.push({ json: { body, signature: sign(secret, body, nowSec()), url: baseUrl + path } });
      } else if (op === 'verify') {
        const header = String(this.getNodeParameter('header', i) || '').trim();
        let raw;
        try {
          raw = (await this.helpers.getBinaryDataBuffer(i, 'data')).toString('utf8');
        } catch {
          out.push({ json: { valid: false, reason: 'no_raw_body' } });
          continue;
        }
        const fail = (reason) => out.push({ json: { valid: false, reason } });
        if (!header) { fail('missing_signature'); continue; }
        const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header);
        if (!m) { fail('malformed_signature'); continue; }
        const t = Number(m[1]);
        if (Math.abs(nowSec() - t) > TOLERANCE_SEC) { fail('timestamp_out_of_window'); continue; }
        const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest();
        const given = Buffer.from(m[2], 'hex');
        if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) { fail('signature_mismatch'); continue; }
        out.push({ json: { valid: true, raw } });
      } else {
        const url = baseUrl + this.getNodeParameter('path', i);
        let lastErr;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // Empty body: message is "<t>."; new timestamp + signature on every attempt (replay-protected endpoint).
            const res = await this.helpers.httpRequest({
              method: 'GET', url, headers: { 'X-LendLoop-Signature': sign(secret, '', nowSec()) }, json: true, timeout: 10000,
            });
            out.push({ json: res });
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = e;
            console.log(JSON.stringify({ level: 'warn', event: 'overdue.fetch_failed', ts: new Date().toISOString(), attempt, status: e && (e.httpCode || e.statusCode), message: String((e && e.message) || e).slice(0, 100) }));
            // Backoff >= 2s also guarantees a different timestamp second, hence a different signature.
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
        if (lastErr) throw lastErr;
      }
    }
    return [out];
  }
}
module.exports = { LendLoopHmac };
