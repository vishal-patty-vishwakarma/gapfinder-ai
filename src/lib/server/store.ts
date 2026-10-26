// Server-side persisted store (MVP local mode).
//
// A per-user JSON workspace, stored under .data/. The shape mirrors what a
// Supabase/Postgres schema would store; the swap is documented in
// docs/ARCHITECTURE.md (Vercel cannot persist local files — see note).
import fs from "fs/promises";
import path from "path";
import type { StoreShape, Workspace, UserProfile } from "@/lib/types";
import { buildSeedState, emptyWorkspaceFor } from "@/lib/server/seed";

const DATA_DIR =
  process.env.GAPFINDER_DATA_DIR ??
  (process.env.VERCEL ? path.join("/tmp", ".data") : path.join(process.cwd(), ".data"));
const DATA_FILE = path.join(DATA_DIR, "state.json");

let cache: StoreShape | null = null;
let saveQueue: Promise<void> = Promise.resolve();

async function read(): Promise<StoreShape | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoreShape;
  } catch {
    return null;
  }
}

export async function getStore(): Promise<StoreShape> {
  if (cache) return cache;
  const persisted = await read();
  if (persisted) {
    cache = persisted;
  } else {
    cache = await buildSeedState();
    await persistNow();
  }
  return cache;
}

async function persistNow(): Promise<void> {
  if (!cache) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 1), "utf8");
}

/**
 * MUTATION helper (single-process lock). All writes go through here so a
 * build-up of parallel saves is serialized (idempotency is preserved even
 * if two requests mutate concurrently).
 */
export async function mutate<T>(fn: (store: StoreShape) => T | Promise<T>): Promise<T> {
  const store = await getStore();
  const result = await fn(store);
  saveQueue = saveQueue.then(() => persistNow()).catch((e) => console.error("persist failed:", e));
  await saveQueue;
  return result;
}

export function workspaceFor(store: StoreShape, userId: string): Workspace {
  let ws = store.workspaces[userId];
  if (!ws) {
    ws = emptyWorkspaceFor(userId, store.users[userId]?.name ?? "");
    store.workspaces[userId] = ws;
  }
  return ws;
}

export function getUserById(store: StoreShape, userId: string): UserProfile | undefined {
  return store.users[userId];
}
