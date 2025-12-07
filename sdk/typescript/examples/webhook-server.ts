/**
 * Webhook Server Example
 * 
 * Example webhook server to receive events from Infinity Assistant
 * 
 * Run with: npx tsx examples/webhook-server.ts
 */

import { InfinityAssistantClient } from '../src';
import crypto from 'crypto';

// Simple webhook server using Node.js http
const http = require('http');

const WEBHOOK_PORT = 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret_here';

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Create webhook server
const server = http.createServer((req: any, res: any) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const signature = req.headers['x-infinity-signature'] || '';
        const isValid = verifySignature(body, signature, WEBHOOK_SECRET);

        if (!isValid) {
          console.error('Invalid webhook signature');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        const event = JSON.parse(body);
        console.log('Received webhook event:', event.event);
        console.log('Data:', JSON.stringify(event.data, null, 2));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      } catch (error: any) {
        console.error('Error processing webhook:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(WEBHOOK_PORT, () => {
  console.log(`Webhook server listening on http://localhost:${WEBHOOK_PORT}/webhook`);
  console.log(`Webhook secret: ${WEBHOOK_SECRET}`);
  console.log('\nTo register this webhook, use the Infinity Assistant SDK:');
  console.log(`
const client = new InfinityAssistantClient({ apiKey: 'your_api_key' });
await client.createWebhook(
  'http://localhost:${WEBHOOK_PORT}/webhook',
  ['chat.message', 'chat.response']
);
  `);
});

