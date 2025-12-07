/**
 * Basic Usage Example
 * 
 * Run with: npx tsx examples/basic-usage.ts
 */

import { InfinityAssistantClient } from '../src';

async function main() {
  // Initialize client
  const client = new InfinityAssistantClient({
    apiKey: process.env.INFINITY_ASSISTANT_API_KEY || 'ia_your_api_key_here',
  });

  try {
    // Health check
    console.log('Checking API health...');
    const health = await client.health();
    console.log('Health:', health);

    // Send a chat message
    console.log('\nSending chat message...');
    const response = await client.chat({
      message: 'Hello! Can you help me understand TypeScript?',
      mode: 'assist',
    });

    console.log('Response:', response.response);
    console.log('Conversation ID:', response.conversationId);

    // Search knowledge base
    console.log('\nSearching knowledge base...');
    const knowledge = await client.searchKnowledge({
      query: 'TypeScript best practices',
      limit: 5,
    });

    console.log(`Found ${knowledge.total} results`);
    knowledge.results?.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title || result.id}`);
      console.log(`   ${result.content.substring(0, 100)}...`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.statusCode) {
      console.error('Status Code:', error.statusCode);
    }
    if (error.code) {
      console.error('Error Code:', error.code);
    }
  }
}

main();

