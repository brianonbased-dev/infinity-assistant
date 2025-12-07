/**
 * Streaming Chat Example
 * 
 * Run with: npx tsx examples/streaming-chat.ts
 */

import { InfinityAssistantClient } from '../src';

async function main() {
  const client = new InfinityAssistantClient({
    apiKey: process.env.INFINITY_ASSISTANT_API_KEY || 'ia_your_api_key_here',
  });

  try {
    console.log('Starting streaming chat...\n');

    let fullResponse = '';

    for await (const chunk of client.chatStream({
      message: 'Write a short story about a robot learning to paint',
      mode: 'assist',
    })) {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.content || '');
        fullResponse += chunk.content || '';
      } else if (chunk.type === 'metadata') {
        console.log('\n\n[Metadata]', chunk.metadata);
      } else if (chunk.type === 'done') {
        console.log('\n\n[Stream complete]');
        break;
      } else if (chunk.type === 'error') {
        console.error('\n\n[Error]', chunk.error);
        break;
      }
    }

    console.log('\n\nFull response length:', fullResponse.length);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();

