import { homedir } from "os";
import { runCommand } from "./utils";

export interface PathSuggestion {
  path: string;
  name: string;
  type: "project" | "directory" | "recent" | "favorite";
  description?: string;
}

/**
 * Get all path suggestions using fuzzy search
 */
export async function getPathSuggestions(
  query: string,
): Promise<PathSuggestion[]> {
  if (!query) {
    return [];
  }
  try {
    const command = `fd -t d . ~ | fzf -f "${query}" | head -n 20`;
    const stdout = await runCommand(command);
    const directories = stdout.trim().split("\n").filter(Boolean);

    return directories.map((dir) => ({
      path: dir,
      name: dir.split("/").pop() || dir,
      type: "directory",
    }));
  } catch (error) {
    console.error("Error getting path suggestions:", error);
    return [];
  }
}
