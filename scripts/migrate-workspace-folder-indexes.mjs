import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Set MONGODB_URI to the database that needs the workspace folder index migration.");
  process.exitCode = 1;
} else {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const folders = client.db().collection("folders");
    const oldKeys = new Set([
      JSON.stringify([["ownerId", 1], ["parentId", 1], ["normalizedName", 1]]),
      JSON.stringify([["workspaceId", 1], ["parentId", 1], ["normalizedName", 1]]),
    ]);

    await folders.createIndex(
      { ownerId: 1, workspaceId: 1, parentId: 1, normalizedName: 1 },
      { unique: true, name: "ownerId_1_workspaceId_1_parentId_1_normalizedName_1" },
    );
    const indexes = await folders.listIndexes().toArray();
    for (const index of indexes) {
      if (index.name === "_id_") continue;
      if (index.unique && oldKeys.has(JSON.stringify(Object.entries(index.key)))) {
        await folders.dropIndex(index.name);
        console.log(`Dropped obsolete unique index ${index.name}.`);
      }
    }
    console.log("Workspace-aware folder uniqueness is ready.");
  } catch (error) {
    console.error("Folder index migration failed.", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
