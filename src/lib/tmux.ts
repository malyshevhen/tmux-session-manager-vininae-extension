import { runCommand } from "./utils";
import { SessionInfo, WindowInfo } from "../types";

// --- Sessions ---

export const getSessions = async (): Promise<SessionInfo[]> => {
  const format =
    "#{session_name}|||#{session_windows}|||#{session_attached}|||#{session_created}|||#{window_name}|||#{session_panes}|||#{session_last_attached}";

  try {
    const stdout = await runCommand(
      `tmux list-sessions -F "${format}" 2>/dev/null`,
    );
    const lines = stdout.trim().split("\n");

    const parsed = lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parts = line.split("|||");
        return {
          name: parts[0],
          windowCount: parseInt(parts[1]) || 0,
          attached: parts[2] === "1",
          created: parts[3],
          currentWindow: parts[4],
          paneCount: parseInt(parts[5]) || 0,
          lastAttached: parseInt(parts[6]) || 0,
        };
      });

    // Sort: Attached first, then recently used
    return parsed.sort((a, b) => {
      if (a.attached !== b.attached) return a.attached ? -1 : 1;
      return b.lastAttached - a.lastAttached;
    });
  } catch (error) {
    // If tmux isn't running, return empty list instead of throwing
    return [];
  }
};

export const switchClient = (target: string) =>
  runCommand(`tmux switch-client -t ${target}`);

export const killSession = (name: string) =>
  runCommand(`tmux kill-session -t ${name}`);

export const createSession = (name: string, dir: string) => {
  const escapedDir = dir.replace(/(["'$`\\])/g, "\\$1");
  return runCommand(`tmux new-session -d -s ${name} -c "${escapedDir}"`);
};

export const renameSession = (oldName: string, newName: string) =>
  runCommand(`tmux rename-session -t ${oldName} ${newName}`);

// --- Windows ---

export const getWindows = async (
  sessionName: string,
): Promise<WindowInfo[]> => {
  const format =
    "#{window_id}|||#{window_index}|||#{window_name}|||#{window_active}|||#{window_layout}";

  const stdout = await runCommand(
    `tmux list-windows -t ${sessionName} -F "${format}" 2>/dev/null`,
  );

  return stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const parts = line.split("|||");
      return {
        id: parts[0],
        index: parts[1],
        name: parts[2],
        active: parts[3] === "1",
        layout: parts[4],
      };
    });
};

export const killWindow = (id: string) =>
  runCommand(`tmux kill-window -t ${id}`);

export const newWindow = (sessionName: string, windowName: string) =>
  runCommand(`tmux new-window -t ${sessionName} -n ${windowName}`);

export const renameWindow = (id: string, newName: string) =>
  runCommand(`tmux rename-window -t ${id} ${newName}`);
