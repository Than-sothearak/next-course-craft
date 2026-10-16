import { MongoClient, ObjectId } from "mongodb";

export async function maintenanceDatabase() {
  if (!process.env.MONGODB_URI) throw new Error("Set protected MONGODB_URI with authenticated database access.");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    await db.command({ ping: 1 });
    const authentication = await db.command({ connectionStatus: 1 });
    if (!authentication.authInfo?.authenticatedUsers?.length) throw new Error("Maintenance requires an authenticated MongoDB connection.");
    const hello = await db.command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Maintenance requires a replica set or sharded MongoDB deployment with transactions.");
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}

export function existingId(value, name) {
  if (!value || !/^[a-f\d]{24}$/i.test(value)) throw new Error(`Set ${name} to an existing account ObjectId.`);
  return new ObjectId(value);
}

export async function initializeControl(db) {
  await db.collection("securitycontrols").updateOne({ _id: "platform" }, { $setOnInsert: { revision: 0, createdAt: new Date() } }, { upsert: true });
  for (const name of ["auditlogs", "rolepermissions", "courseassignments", "platformsettings"]) {
    if (!(await db.listCollections({ name }).hasNext())) await db.createCollection(name);
  }
}
