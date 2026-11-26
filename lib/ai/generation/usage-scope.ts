import { AsyncLocalStorage } from "node:async_hooks";

const courseScope = new AsyncLocalStorage<string>();
export const generationUsageCourseId = () => courseScope.getStore();

export function withCourseUsage<Scope extends { courseId: string }, Args extends unknown[], Result>(work: (scope: Scope, ...args: Args) => Result) {
  return (scope: Scope, ...args: Args): Result => courseScope.run(scope.courseId, () => work(scope, ...args));
}
