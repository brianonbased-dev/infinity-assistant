'use client';

import { DeveloperWorkspace } from '@/components/developer';

export default function DeveloperConsolePage() {
  // In a real app, we would check auth here
  // For now, we mock the signed-in user
  const mockWorkspaceId = 'ws-dev-001';
  const mockWorkspaceType = 'full-stack-assistant';

  return (
    <div className="h-screen w-full bg-black">
      <DeveloperWorkspace 
        workspaceId={mockWorkspaceId}
        workspaceType={mockWorkspaceType}
        workspaceName="Developer Console"
        initialView="getting-started"
        onClose={() => window.location.href = '/developers'}
      />
    </div>
  );
}
