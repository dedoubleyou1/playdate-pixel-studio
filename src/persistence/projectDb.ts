import Dexie, { type EntityTable } from "dexie";
import type { PlaydateProjectDocument, ProjectSummary } from "./projectSchema";

interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  document: PlaydateProjectDocument;
}

const db = new Dexie("playdate_pixel_studio") as Dexie & {
  projects: EntityTable<ProjectRecord, "id">;
};

db.version(1).stores({
  projects: "id, name, updatedAt",
});

export async function saveProjectDocument(document: PlaydateProjectDocument): Promise<ProjectSummary> {
  const record = {
    id: document.id,
    name: document.name,
    updatedAt: document.updatedAt,
    document,
  };
  await db.projects.put(record);
  return { id: record.id, name: record.name, updatedAt: record.updatedAt };
}

export async function loadProjectDocument(id: string): Promise<PlaydateProjectDocument | null> {
  const record = await db.projects.get(id);
  return record?.document ?? null;
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const records = await db.projects.orderBy("updatedAt").reverse().toArray();
  return records.map((record) => ({ id: record.id, name: record.name, updatedAt: record.updatedAt }));
}

export async function deleteProjectDocument(id: string): Promise<void> {
  await db.projects.delete(id);
}
