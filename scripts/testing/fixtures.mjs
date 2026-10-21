import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

/** Synthetic accounts and sessions exist only in a randomly named test database. */
export async function seedAuthorFixtures(db, authorCount = 100) {
  const now = new Date();
  const authors = Array.from({ length: authorCount }, (_, index) => ({
    _id: new ObjectId(), name: `Test Author ${index + 1}`, email: `author-${index + 1}@example.invalid`,
    emailVerified: now, image: null, role: "editor", status: "active", deletedAt: null, createdAt: now, updatedAt: now,
  }));
  const workspaces = Array.from({ length: Math.ceil(authorCount / 10) }, (_, index) => ({
    _id: new ObjectId(), name: `Test Team ${index + 1}`, ownerId: authors[index * 10]._id, createdAt: now, updatedAt: now,
  }));
  const sessions = authors.map((user) => ({ userId: user._id, sessionToken: randomUUID(), expires: new Date(Date.now() + 3600000) }));
  const memberships = authors.flatMap((user, index) => index % 10 ? [{ workspaceId: workspaces[Math.floor(index / 10)]._id, userId: user._id, role: "editor", createdAt: now, updatedAt: now }] : []);
  const folders = authors.flatMap((user) => ["Projects", "Training"].map((name) => ({ _id: new ObjectId(), name, normalizedName: name.toLowerCase(), ownerId: user._id, workspaceId: null, parentId: null, createdAt: now, updatedAt: now })));
  const courses = [];
  const lessons = [];
  const authorCourses = new Map();
  function addCourse(ownerId, createdBy, index, workspaceId = null, folderId = null) {
    const _id = new ObjectId();
    const sections = [0, 1].map((order) => ({ id: `section-${order}`, title: order ? "Practice" : "Learn", order }));
    courses.push({
      _id, ownerId, createdBy, workspaceId, folderId, title: `Test Course ${index + 1}`, description: "Synthetic authoring course for automated verification.",
      sections, authorVisible: true, language: "en", navigationMode: "sequential", status: "draft", revision: 0,
      theme: { preset: "ocean", primaryColor: "#2f5f9f", accentColor: "#ff876c", fontFamily: "sans" },
      coverImage: null, deletedAt: null, editorSaveLock: null, editorSaveLockAt: null, generationLockToken: null, generationLockUntil: null,
      createdAt: now, updatedAt: now,
    });
    for (let lessonIndex = 0; lessonIndex < 6; lessonIndex += 1) {
      const blocks = Array.from({ length: 10 }, (_, blockIndex) => ({
        id: `block-${lessonIndex}-${blockIndex}`, version: 1, type: "richText",
        data: { html: `<p>Training activity ${blockIndex + 1}. ${"Read the example, consider the decision, and apply the procedure. ".repeat(5)}</p>` },
      }));
      lessons.push({ _id: new ObjectId(), courseId: _id, editorId: `lesson-${lessonIndex}`, sectionId: sections[Math.floor(lessonIndex / 3)].id,
        title: `Lesson ${lessonIndex + 1}`, order: lessonIndex % 3, icon: "file", lessonType: "content", passingScore: 70, quizQuestions: [], blocks, revision: 0, createdAt: now, updatedAt: now });
    }
    return _id.toString();
  }
  for (const [index, author] of authors.entries()) {
    authorCourses.set(author._id.toString(), Array.from({ length: 5 }, (_, courseIndex) => addCourse(author._id, author._id, index * 5 + courseIndex, null, courseIndex > 2 ? folders[index * 2]._id : null)));
  }
  for (const [index, workspace] of workspaces.entries()) {
    for (let courseIndex = 0; courseIndex < 10; courseIndex += 1) addCourse(workspace.ownerId, workspace.ownerId, index * 10 + courseIndex, workspace._id);
  }
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection("courses").createIndex({ ownerId: 1, folderId: 1, updatedAt: -1 }),
    db.collection("courses").createIndex({ workspaceId: 1, folderId: 1, updatedAt: -1 }),
    db.collection("lessons").createIndex({ courseId: 1, sectionId: 1, order: 1 }),
    db.collection("lessons").createIndex({ courseId: 1, editorId: 1 }, { unique: true, partialFilterExpression: { editorId: { $type: "string" } } }),
    db.collection("workspacememberships").createIndex({ workspaceId: 1, userId: 1 }, { unique: true }),
    db.collection("workspacememberships").createIndex({ userId: 1, workspaceId: 1 }),
  ]);
  await db.collection("users").insertMany(authors);
  await db.collection("sessions").insertMany(sessions);
  await db.collection("workspaces").insertMany(workspaces);
  if (memberships.length) await db.collection("workspacememberships").insertMany(memberships);
  await db.collection("folders").insertMany(folders);
  await db.collection("courses").insertMany(courses);
  await db.collection("lessons").insertMany(lessons);
  return {
    authors: authors.map((user, index) => ({ id: user._id.toString(), name: user.name, cookie: `authjs.session-token=${sessions[index].sessionToken}`,
      courseIds: authorCourses.get(user._id.toString()), workspaceId: workspaces[Math.floor(index / 10)]._id.toString() })),
    dataSize: { authors: authors.length, workspaces: workspaces.length, courses: courses.length, lessons: lessons.length, blocks: lessons.length * 10 },
  };
}
