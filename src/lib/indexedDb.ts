import { AudioChunkRecord, AudioPartBlob, SessionRecord } from '../types/facilitation';
import { getExtForMime } from './audioRecorder';

const DB_NAME = 'facilitation_toolkit_db';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const CHUNKS_STORE = 'audioChunks';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        chunkStore.createIndex('by_session', 'sessionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });

  return dbPromise;
}

export async function saveSessionMeta(record: SessionRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite');
    tx.objectStore(SESSIONS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save session meta'));
  });
}

export async function appendAudioChunk(chunk: Omit<AudioChunkRecord, 'id'>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    tx.objectStore(CHUNKS_STORE).add(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to append audio chunk'));
  });
}

export async function getUnfinishedSession(): Promise<SessionRecord | null> {
  try {
    const db = await openDb();
    const sessions = await new Promise<SessionRecord[]>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const req = tx.objectStore(SESSIONS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as SessionRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    const unfinished = sessions
      .filter((s) => s.status !== 'completed')
      .sort((a, b) => b.sessionStartedAt.localeCompare(a.sessionStartedAt));

    return unfinished[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSessionAudioParts(
  sessionId: string,
  fallbackMimeType: string
): Promise<AudioPartBlob[]> {
  try {
    const db = await openDb();
    const chunks = await new Promise<AudioChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(CHUNKS_STORE, 'readonly');
      const index = tx.objectStore(CHUNKS_STORE).index('by_session');
      const req = index.getAll(IDBKeyRange.only(sessionId));
      req.onsuccess = () => resolve((req.result as AudioChunkRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    if (chunks.length === 0) return [];

    const byPart = new Map<number, AudioChunkRecord[]>();
    for (const c of chunks) {
      const list = byPart.get(c.part) ?? [];
      list.push(c);
      byPart.set(c.part, list);
    }

    const parts: AudioPartBlob[] = [];
    const sortedPartNums = Array.from(byPart.keys()).sort((a, b) => a - b);

    for (const partNum of sortedPartNums) {
      const partChunks = (byPart.get(partNum) ?? []).sort((a, b) => a.seq - b.seq);
      const mimeType = partChunks[0]?.mimeType || fallbackMimeType || 'audio/webm';
      const blob = new Blob(
        partChunks.map((c) => c.blob),
        { type: mimeType }
      );
      if (blob.size > 0) {
        parts.push({
          part: partNum,
          mimeType,
          ext: getExtForMime(mimeType),
          blob,
        });
      }
    }

    return parts;
  } catch {
    return [];
  }
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, CHUNKS_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).delete(sessionId);

      const chunkStore = tx.objectStore(CHUNKS_STORE);
      const index = chunkStore.index('by_session');
      const cursorReq = index.openCursor(IDBKeyRange.only(sessionId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete session data'));
    });
  } catch {
    // Ignore IDB cleanup error
  }
}
