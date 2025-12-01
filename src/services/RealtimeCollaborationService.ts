/**
 * Real-time Collaboration Service
 *
 * Handles live collaboration features including WebSocket connections,
 * cursor presence, conflict resolution, and real-time sync.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface CollaborationSession {
  id: string;
  projectId: string;
  createdAt: string;
  participants: Participant[];
  activeFile?: string;
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionRange>;
  locks: Map<string, FileLock>;
}

export interface Participant {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  status: PresenceStatus;
  lastActive: string;
  currentFile?: string;
  connectionId: string;
}

export interface CursorPosition {
  participantId: string;
  file: string;
  line: number;
  column: number;
  timestamp: string;
}

export interface SelectionRange {
  participantId: string;
  file: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
  timestamp: string;
}

export interface FileLock {
  file: string;
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
  type: 'soft' | 'hard';
}

export interface CollaborativeEdit {
  id: string;
  sessionId: string;
  participantId: string;
  file: string;
  operation: EditOperation;
  timestamp: string;
  version: number;
}

export type EditOperation =
  | { type: 'insert'; position: Position; text: string }
  | { type: 'delete'; start: Position; end: Position }
  | { type: 'replace'; start: Position; end: Position; text: string };

export interface Position {
  line: number;
  column: number;
}

export interface ConflictResolution {
  id: string;
  file: string;
  localEdit: CollaborativeEdit;
  remoteEdit: CollaborativeEdit;
  resolution: 'local' | 'remote' | 'merge' | 'manual';
  mergedContent?: string;
  resolvedAt: string;
  resolvedBy: string;
}

export interface Comment {
  id: string;
  sessionId: string;
  authorId: string;
  file: string;
  line: number;
  content: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface CollaborationMessage {
  type: MessageType;
  sessionId: string;
  senderId: string;
  payload: unknown;
  timestamp: string;
}

export type MessageType =
  | 'join'
  | 'leave'
  | 'cursor_move'
  | 'selection_change'
  | 'edit'
  | 'lock_request'
  | 'lock_release'
  | 'comment_add'
  | 'comment_resolve'
  | 'file_open'
  | 'file_close'
  | 'presence_update'
  | 'sync_request'
  | 'sync_response'
  | 'conflict_detected'
  | 'conflict_resolved';

export interface SyncState {
  version: number;
  checksum: string;
  lastSync: string;
  pendingEdits: CollaborativeEdit[];
}

// =============================================================================
// OPERATIONAL TRANSFORMATION
// =============================================================================

class OperationalTransform {
  /**
   * Transform operation A against operation B
   * Returns the transformed operation A' that can be applied after B
   */
  transform(opA: EditOperation, opB: EditOperation, _file: string): EditOperation {
    if (opA.type === 'insert' && opB.type === 'insert') {
      return this.transformInsertInsert(opA, opB);
    }
    if (opA.type === 'insert' && opB.type === 'delete') {
      return this.transformInsertDelete(opA, opB);
    }
    if (opA.type === 'delete' && opB.type === 'insert') {
      return this.transformDeleteInsert(opA, opB);
    }
    if (opA.type === 'delete' && opB.type === 'delete') {
      return this.transformDeleteDelete(opA, opB);
    }
    return opA;
  }

  private transformInsertInsert(
    opA: Extract<EditOperation, { type: 'insert' }>,
    opB: Extract<EditOperation, { type: 'insert' }>
  ): EditOperation {
    const posA = this.positionToOffset(opA.position);
    const posB = this.positionToOffset(opB.position);

    if (posA <= posB) {
      return opA;
    } else {
      return {
        type: 'insert',
        position: this.offsetToPosition(posA + opB.text.length),
        text: opA.text,
      };
    }
  }

  private transformInsertDelete(
    opA: Extract<EditOperation, { type: 'insert' }>,
    opB: Extract<EditOperation, { type: 'delete' }>
  ): EditOperation {
    const posA = this.positionToOffset(opA.position);
    const startB = this.positionToOffset(opB.start);
    const endB = this.positionToOffset(opB.end);
    const lenB = endB - startB;

    if (posA <= startB) {
      return opA;
    } else if (posA >= endB) {
      return {
        type: 'insert',
        position: this.offsetToPosition(posA - lenB),
        text: opA.text,
      };
    } else {
      return {
        type: 'insert',
        position: this.offsetToPosition(startB),
        text: opA.text,
      };
    }
  }

  private transformDeleteInsert(
    opA: Extract<EditOperation, { type: 'delete' }>,
    opB: Extract<EditOperation, { type: 'insert' }>
  ): EditOperation {
    const startA = this.positionToOffset(opA.start);
    const endA = this.positionToOffset(opA.end);
    const posB = this.positionToOffset(opB.position);
    const lenB = opB.text.length;

    if (endA <= posB) {
      return opA;
    } else if (startA >= posB) {
      return {
        type: 'delete',
        start: this.offsetToPosition(startA + lenB),
        end: this.offsetToPosition(endA + lenB),
      };
    } else {
      return {
        type: 'delete',
        start: opA.start,
        end: this.offsetToPosition(endA + lenB),
      };
    }
  }

  private transformDeleteDelete(
    opA: Extract<EditOperation, { type: 'delete' }>,
    opB: Extract<EditOperation, { type: 'delete' }>
  ): EditOperation {
    const startA = this.positionToOffset(opA.start);
    const endA = this.positionToOffset(opA.end);
    const startB = this.positionToOffset(opB.start);
    const endB = this.positionToOffset(opB.end);
    const lenB = endB - startB;

    if (endA <= startB) {
      return opA;
    } else if (startA >= endB) {
      return {
        type: 'delete',
        start: this.offsetToPosition(startA - lenB),
        end: this.offsetToPosition(endA - lenB),
      };
    } else if (startA >= startB && endA <= endB) {
      // A is entirely within B, nothing to delete
      return {
        type: 'delete',
        start: this.offsetToPosition(startB),
        end: this.offsetToPosition(startB),
      };
    } else if (startA < startB && endA > endB) {
      // A encompasses B
      return {
        type: 'delete',
        start: opA.start,
        end: this.offsetToPosition(endA - lenB),
      };
    } else if (startA < startB) {
      // A starts before B, overlaps
      return {
        type: 'delete',
        start: opA.start,
        end: this.offsetToPosition(startB),
      };
    } else {
      // A starts within B
      return {
        type: 'delete',
        start: this.offsetToPosition(startB),
        end: this.offsetToPosition(endA - (endB - startA)),
      };
    }
  }

  private positionToOffset(pos: Position): number {
    // Simplified: assume 100 chars per line
    return pos.line * 100 + pos.column;
  }

  private offsetToPosition(offset: number): Position {
    return {
      line: Math.floor(offset / 100),
      column: offset % 100,
    };
  }
}

// =============================================================================
// CONFLICT RESOLVER
// =============================================================================

class ConflictResolver {
  private ot: OperationalTransform;

  constructor() {
    this.ot = new OperationalTransform();
  }

  detectConflict(localEdit: CollaborativeEdit, remoteEdit: CollaborativeEdit): boolean {
    if (localEdit.file !== remoteEdit.file) return false;

    const localRange = this.getEditRange(localEdit.operation);
    const remoteRange = this.getEditRange(remoteEdit.operation);

    return this.rangesOverlap(localRange, remoteRange);
  }

  resolve(
    localEdit: CollaborativeEdit,
    remoteEdit: CollaborativeEdit,
    strategy: 'local' | 'remote' | 'merge'
  ): ConflictResolution {
    const id = `conflict_${Date.now()}`;

    if (strategy === 'local') {
      return {
        id,
        file: localEdit.file,
        localEdit,
        remoteEdit,
        resolution: 'local',
        resolvedAt: new Date().toISOString(),
        resolvedBy: localEdit.participantId,
      };
    }

    if (strategy === 'remote') {
      return {
        id,
        file: localEdit.file,
        localEdit,
        remoteEdit,
        resolution: 'remote',
        resolvedAt: new Date().toISOString(),
        resolvedBy: remoteEdit.participantId,
      };
    }

    // Merge using OT
    const transformedLocal = this.ot.transform(
      localEdit.operation,
      remoteEdit.operation,
      localEdit.file
    );

    return {
      id,
      file: localEdit.file,
      localEdit: { ...localEdit, operation: transformedLocal },
      remoteEdit,
      resolution: 'merge',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'system',
    };
  }

  private getEditRange(op: EditOperation): { start: number; end: number } {
    if (op.type === 'insert') {
      const pos = op.position.line * 100 + op.position.column;
      return { start: pos, end: pos + op.text.length };
    }
    return {
      start: op.start.line * 100 + op.start.column,
      end: op.end.line * 100 + op.end.column,
    };
  }

  private rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
    return a.start < b.end && b.start < a.end;
  }
}

// =============================================================================
// REALTIME COLLABORATION SERVICE
// =============================================================================

export class RealtimeCollaborationService {
  private static instance: RealtimeCollaborationService;
  private sessions: Map<string, CollaborationSession> = new Map();
  private connections: Map<string, WebSocketConnection> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private ot: OperationalTransform;
  private conflictResolver: ConflictResolver;
  private messageHandlers: Map<string, Set<(msg: CollaborationMessage) => void>> = new Map();

  // Participant colors for visual identification
  private readonly COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];

  private constructor() {
    this.ot = new OperationalTransform();
    this.conflictResolver = new ConflictResolver();
  }

  static getInstance(): RealtimeCollaborationService {
    if (!RealtimeCollaborationService.instance) {
      RealtimeCollaborationService.instance = new RealtimeCollaborationService();
    }
    return RealtimeCollaborationService.instance;
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  async createSession(projectId: string): Promise<CollaborationSession> {
    const sessionId = this.generateId();

    const session: CollaborationSession = {
      id: sessionId,
      projectId,
      createdAt: new Date().toISOString(),
      participants: [],
      cursors: new Map(),
      selections: new Map(),
      locks: new Map(),
    };

    this.sessions.set(sessionId, session);
    this.syncStates.set(sessionId, {
      version: 0,
      checksum: '',
      lastSync: new Date().toISOString(),
      pendingEdits: [],
    });
    this.comments.set(sessionId, []);

    return session;
  }

  async joinSession(
    sessionId: string,
    user: { userId: string; name: string; email: string; avatar?: string }
  ): Promise<{ session: CollaborationSession; participant: Participant }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const connectionId = this.generateId();
    const colorIndex = session.participants.length % this.COLORS.length;

    const participant: Participant = {
      ...user,
      color: this.COLORS[colorIndex],
      status: 'online',
      lastActive: new Date().toISOString(),
      connectionId,
    };

    session.participants.push(participant);

    // Broadcast join to other participants
    this.broadcast(sessionId, {
      type: 'join',
      sessionId,
      senderId: user.userId,
      payload: participant,
      timestamp: new Date().toISOString(),
    });

    return { session, participant };
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove participant
    session.participants = session.participants.filter((p) => p.userId !== userId);

    // Remove their cursor and selection
    session.cursors.delete(userId);
    session.selections.delete(userId);

    // Release any locks they hold
    for (const [file, lock] of session.locks) {
      if (lock.lockedBy === userId) {
        session.locks.delete(file);
      }
    }

    // Broadcast leave
    this.broadcast(sessionId, {
      type: 'leave',
      sessionId,
      senderId: userId,
      payload: { userId },
      timestamp: new Date().toISOString(),
    });

    // Clean up empty sessions
    if (session.participants.length === 0) {
      this.sessions.delete(sessionId);
      this.syncStates.delete(sessionId);
      this.comments.delete(sessionId);
    }
  }

  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // ===========================================================================
  // CURSOR & SELECTION TRACKING
  // ===========================================================================

  updateCursor(sessionId: string, userId: string, cursor: Omit<CursorPosition, 'participantId' | 'timestamp'>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const cursorPosition: CursorPosition = {
      ...cursor,
      participantId: userId,
      timestamp: new Date().toISOString(),
    };

    session.cursors.set(userId, cursorPosition);

    // Update participant's current file
    const participant = session.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.currentFile = cursor.file;
      participant.lastActive = cursorPosition.timestamp;
    }

    this.broadcast(sessionId, {
      type: 'cursor_move',
      sessionId,
      senderId: userId,
      payload: cursorPosition,
      timestamp: cursorPosition.timestamp,
    });
  }

  updateSelection(sessionId: string, userId: string, selection: Omit<SelectionRange, 'participantId' | 'timestamp'>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const selectionRange: SelectionRange = {
      ...selection,
      participantId: userId,
      timestamp: new Date().toISOString(),
    };

    session.selections.set(userId, selectionRange);

    this.broadcast(sessionId, {
      type: 'selection_change',
      sessionId,
      senderId: userId,
      payload: selectionRange,
      timestamp: selectionRange.timestamp,
    });
  }

  getCursors(sessionId: string): CursorPosition[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.cursors.values());
  }

  getSelections(sessionId: string): SelectionRange[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.selections.values());
  }

  // ===========================================================================
  // FILE LOCKING
  // ===========================================================================

  async requestLock(
    sessionId: string,
    userId: string,
    file: string,
    type: 'soft' | 'hard' = 'soft'
  ): Promise<FileLock | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const existingLock = session.locks.get(file);
    if (existingLock) {
      // Check if lock is expired
      if (new Date(existingLock.expiresAt) > new Date()) {
        if (existingLock.lockedBy !== userId) {
          return null; // Cannot acquire lock
        }
        // User already has lock, extend it
      }
    }

    const lock: FileLock = {
      file,
      lockedBy: userId,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      type,
    };

    session.locks.set(file, lock);

    this.broadcast(sessionId, {
      type: 'lock_request',
      sessionId,
      senderId: userId,
      payload: lock,
      timestamp: lock.lockedAt,
    });

    return lock;
  }

  async releaseLock(sessionId: string, userId: string, file: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const lock = session.locks.get(file);
    if (lock && lock.lockedBy === userId) {
      session.locks.delete(file);

      this.broadcast(sessionId, {
        type: 'lock_release',
        sessionId,
        senderId: userId,
        payload: { file },
        timestamp: new Date().toISOString(),
      });
    }
  }

  getLocks(sessionId: string): FileLock[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.locks.values());
  }

  // ===========================================================================
  // COLLABORATIVE EDITING
  // ===========================================================================

  async applyEdit(sessionId: string, edit: Omit<CollaborativeEdit, 'id' | 'timestamp' | 'version'>): Promise<CollaborativeEdit> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const syncState = this.syncStates.get(sessionId)!;

    // Check for conflicts with pending edits
    for (const pendingEdit of syncState.pendingEdits) {
      if (this.conflictResolver.detectConflict({ ...edit, id: '', timestamp: '', version: 0 } as CollaborativeEdit, pendingEdit)) {
        // Transform the edit
        edit.operation = this.ot.transform(edit.operation, pendingEdit.operation, edit.file);
      }
    }

    const collaborativeEdit: CollaborativeEdit = {
      ...edit,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      version: ++syncState.version,
    };

    syncState.pendingEdits.push(collaborativeEdit);
    syncState.lastSync = collaborativeEdit.timestamp;

    // Keep only last 100 edits
    if (syncState.pendingEdits.length > 100) {
      syncState.pendingEdits = syncState.pendingEdits.slice(-100);
    }

    // Broadcast edit
    this.broadcast(sessionId, {
      type: 'edit',
      sessionId,
      senderId: edit.participantId,
      payload: collaborativeEdit,
      timestamp: collaborativeEdit.timestamp,
    });

    return collaborativeEdit;
  }

  async syncState(sessionId: string, clientVersion: number): Promise<{ edits: CollaborativeEdit[]; version: number }> {
    const syncState = this.syncStates.get(sessionId);
    if (!syncState) {
      return { edits: [], version: 0 };
    }

    // Return all edits since client's version
    const missedEdits = syncState.pendingEdits.filter((e) => e.version > clientVersion);

    return {
      edits: missedEdits,
      version: syncState.version,
    };
  }

  // ===========================================================================
  // COMMENTS & ANNOTATIONS
  // ===========================================================================

  async addComment(
    sessionId: string,
    comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'resolved'>
  ): Promise<Comment> {
    const comments = this.comments.get(sessionId);
    if (!comments) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newComment: Comment = {
      ...comment,
      id: this.generateId(),
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };

    comments.push(newComment);

    this.broadcast(sessionId, {
      type: 'comment_add',
      sessionId,
      senderId: comment.authorId,
      payload: newComment,
      timestamp: newComment.createdAt,
    });

    return newComment;
  }

  async replyToComment(
    sessionId: string,
    commentId: string,
    reply: Omit<CommentReply, 'id' | 'createdAt'>
  ): Promise<CommentReply> {
    const comments = this.comments.get(sessionId);
    if (!comments) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error(`Comment not found: ${commentId}`);
    }

    const newReply: CommentReply = {
      ...reply,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    comment.replies.push(newReply);
    comment.updatedAt = newReply.createdAt;

    return newReply;
  }

  async resolveComment(sessionId: string, commentId: string, userId: string): Promise<void> {
    const comments = this.comments.get(sessionId);
    if (!comments) return;

    const comment = comments.find((c) => c.id === commentId);
    if (comment) {
      comment.resolved = true;
      comment.updatedAt = new Date().toISOString();

      this.broadcast(sessionId, {
        type: 'comment_resolve',
        sessionId,
        senderId: userId,
        payload: { commentId },
        timestamp: comment.updatedAt,
      });
    }
  }

  getComments(sessionId: string, file?: string): Comment[] {
    const comments = this.comments.get(sessionId) || [];
    if (file) {
      return comments.filter((c) => c.file === file);
    }
    return comments;
  }

  // ===========================================================================
  // PRESENCE
  // ===========================================================================

  updatePresence(sessionId: string, userId: string, status: PresenceStatus): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.status = status;
      participant.lastActive = new Date().toISOString();

      this.broadcast(sessionId, {
        type: 'presence_update',
        sessionId,
        senderId: userId,
        payload: { userId, status },
        timestamp: participant.lastActive,
      });
    }
  }

  getPresence(sessionId: string): Participant[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.participants;
  }

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  subscribe(sessionId: string, handler: (msg: CollaborationMessage) => void): () => void {
    if (!this.messageHandlers.has(sessionId)) {
      this.messageHandlers.set(sessionId, new Set());
    }
    this.messageHandlers.get(sessionId)!.add(handler);

    return () => {
      this.messageHandlers.get(sessionId)?.delete(handler);
    };
  }

  private broadcast(sessionId: string, message: CollaborationMessage): void {
    const handlers = this.messageHandlers.get(sessionId);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      });
    }
  }

  // ===========================================================================
  // WEBSOCKET CONNECTION SIMULATION
  // ===========================================================================

  async connect(sessionId: string, userId: string): Promise<WebSocketConnection> {
    const connectionId = this.generateId();

    const connection: WebSocketConnection = {
      id: connectionId,
      sessionId,
      userId,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      send: (message: CollaborationMessage) => {
        this.broadcast(sessionId, message);
      },
      close: () => {
        this.connections.delete(connectionId);
        this.leaveSession(sessionId, userId);
      },
    };

    this.connections.set(connectionId, connection);

    return connection;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private generateId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface WebSocketConnection {
  id: string;
  sessionId: string;
  userId: string;
  status: ConnectionStatus;
  connectedAt: string;
  send: (message: CollaborationMessage) => void;
  close: () => void;
}

// Export singleton
export const realtimeCollaboration = RealtimeCollaborationService.getInstance();
