// IMPORTANT: This file is for Node.js/server-side usage ONLY. Do not import in client or shared code.
if (typeof window !== 'undefined') {
  throw new Error('UserMemoryStorageServer must not be imported in browser/client code.');
}
/**
 * User Memory Storage Server Utility
 *
 * Node.js-only file-based memory operations for Infinity Assistant.
 * This file should only be imported in API routes or server actions.
 */

import type { UserLocalMemory } from './UserMemoryStorageService';

export async function readLocalMemoryServer(userId: string): Promise<UserLocalMemory | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');

    const memoryDir = path.join(os.homedir(), '.infinity-assistant', 'memories', userId);
    const memoryFile = path.join(memoryDir, 'memory.json');

    if (fs.existsSync(memoryFile)) {
      const content = fs.readFileSync(memoryFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[UserMemoryStorageServer] Failed to read file:', error);
  }
  return null;
}

export async function writeLocalMemoryServer(userId: string, memory: UserLocalMemory): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');

    const memoryDir = path.join(os.homedir(), '.infinity-assistant', 'memories', userId);
    const memoryFile = path.join(memoryDir, 'memory.json');

    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[UserMemoryStorageServer] Failed to write file:', error);
    return false;
  }
}
