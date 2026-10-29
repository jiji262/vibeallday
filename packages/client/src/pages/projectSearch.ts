import { projectDisplayName } from "@vibeallday/shared";
import type { Project } from "../types";

/** The text a project search matches: names, path, code name and caption. */
function searchableText(project: Project): string {
  return [
    projectDisplayName(project),
    project.name,
    project.path,
    project.codeName ?? "",
    project.caption?.text ?? "",
  ]
    .join("\n")
    .toLocaleLowerCase();
}

/**
 * Client-side filter over the loaded list. Every whitespace-separated term
 * must appear somewhere in the project's searchable text.
 */
export function filterProjectsByQuery(
  projects: readonly Project[],
  query: string,
): readonly Project[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return projects;
  return projects.filter((project) => {
    const text = searchableText(project);
    return terms.every((term) => text.includes(term));
  });
}
