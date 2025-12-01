import {
  Action,
  ActionPanel,
  Icon,
  List,
  showToast,
  Form,
  useNavigation,
  confirmAlert,
  Color,
  Toast,
} from "@vicinae/api";
import { useEffect, useState, useCallback } from "react";
import { exec, ExecException } from "child_process";

// --- Types ---

type SessionInfo = {
  name: string;
  windowCount: number;
  attached: boolean;
  created: string;
  currentWindow: string;
  paneCount: number;
};

type WindowInfo = {
  id: string; // Unique ID (e.g. @1)
  index: string; // Ordered index (e.g. 1)
  name: string;
  active: boolean;
  layout: string;
};

// --- Helper Functions ---

const runCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (error: ExecException | null, stdout: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

const handleError = (title: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
};

// --- Components ---

export default function TmuxSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  const loadSessions = useCallback(() => {
    setIsLoading(true);
    // Get basic session list
    exec(
      "tmux list-sessions 2>/dev/null | awk '{print $1}' | sed 's/://'",
      (error, stdout) => {
        if (error) {
          // If no server running or no sessions, standard error
          setSessions([]);
          setIsLoading(false);
          return;
        }

        const sessionNames = stdout
          .trim()
          .split("\n")
          .filter((s) => s.length > 0);

        // Load details for each session
        const sessionPromises = sessionNames.map((sessionName) => {
          return new Promise<SessionInfo>((resolve) => {
            // Format: attached(0/1), created(timestamp), active_window_name, num_panes, num_windows
            exec(
              `tmux display-message -p -t ${sessionName} "#{session_attached},#{session_created},#{window_name},#{session_panes},#{session_windows}" 2>/dev/null`,
              (detailError, detailStdout) => {
                let attached = false;
                let created = "";
                let currentWindow = "";
                let paneCount = 0;
                let windowCount = 0;

                if (!detailError && detailStdout.trim()) {
                  const details = detailStdout.trim().split(",");
                  attached = details[0] === "1";
                  created = details[1] || "";
                  currentWindow = details[2] || "";
                  paneCount = parseInt(details[3]) || 0;
                  windowCount = parseInt(details[4]) || 0;
                }

                resolve({
                  name: sessionName,
                  windowCount,
                  attached,
                  created,
                  currentWindow,
                  paneCount,
                });
              },
            );
          });
        });

        Promise.all(sessionPromises).then((sessionInfos) => {
          setSessions(sessionInfos);
          setIsLoading(false);
        });
      },
    );
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000); // Auto-refresh
    return () => clearInterval(interval);
  }, [loadSessions]);

  const switchToSession = async (sessionName: string) => {
    try {
      await runCommand(`tmux switch-client -t ${sessionName}`);
      showToast({ title: `Switched to session ${sessionName}` });
    } catch (e) {
      // Fallback: if we are not in tmux, maybe we can't switch-client.
      // But typically this extension assumes tmux usage.
      handleError("Failed to switch session", e);
    }
  };

  const deleteSession = async (sessionName: string) => {
    if (
      await confirmAlert({
        title: "Delete Session",
        message: `Delete "${sessionName}"? This cannot be undone.`,
        primaryAction: { title: "Delete", style: Action.Style.Destructive },
      })
    ) {
      try {
        await runCommand(`tmux kill-session -t ${sessionName}`);
        showToast({ title: "Deleted session" });
        loadSessions();
      } catch (e) {
        handleError("Failed to delete session", e);
      }
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search TMUX sessions..."
      actions={
        <ActionPanel>
          <Action
            title="Create New Session"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["ctrl"], key: "n" }}
            onAction={() => push(<CreateSessionForm onCreate={loadSessions} />)}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={loadSessions}
          />
        </ActionPanel>
      }
    >
      <List.Section title="Active Sessions">
        {sessions.map((session) => (
          <List.Item
            key={session.name}
            title={session.name}
            subtitle={`${session.windowCount} win • ${session.paneCount} panes`}
            icon={{
              source: session.attached ? Icon.Terminal : Icon.Circle,
              tintColor: session.attached ? Color.Green : Color.SecondaryText,
            }}
            accessories={[
              { text: session.attached ? "Attached" : "Detached" },
              ...(session.currentWindow
                ? [{ icon: Icon.Window, text: session.currentWindow }]
                : []),
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Switch to Session"
                  icon={Icon.ArrowRight}
                  onAction={() => switchToSession(session.name)}
                />
                <Action
                  title="Manage Windows"
                  icon={Icon.List}
                  shortcut={{ modifiers: ["shift"], key: "return" }}
                  onAction={() =>
                    push(<WindowList sessionName={session.name} />)
                  }
                />
                <Action
                  title="Rename Session"
                  icon={Icon.Pencil}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={() =>
                    push(
                      <RenameSessionForm
                        currentName={session.name}
                        onRename={loadSessions}
                      />,
                    )
                  }
                />
                <Action
                  title="Delete Session"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "d" }}
                  onAction={() => deleteSession(session.name)}
                />
                <Action
                  title="Create New Session"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["ctrl"], key: "n" }}
                  onAction={() =>
                    push(<CreateSessionForm onCreate={loadSessions} />)
                  }
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function WindowList({ sessionName }: { sessionName: string }) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  const loadWindows = useCallback(() => {
    setIsLoading(true);
    // Format: id, index, name, active_flag, layout
    exec(
      `tmux list-windows -t ${sessionName} -F "#{window_id},#{window_index},#{window_name},#{window_active},#{window_layout}" 2>/dev/null`,
      (error, stdout) => {
        if (error) {
          handleError("Error loading windows", error);
          setIsLoading(false);
          return;
        }

        const lines = stdout.trim().split("\n");
        const parsedWindows: WindowInfo[] = lines
          .filter((l) => l.length > 0)
          .map((line) => {
            const [id, index, name, active, layout] = line.split(",");
            return {
              id,
              index,
              name,
              active: active === "1",
              layout,
            };
          });

        setWindows(parsedWindows);
        setIsLoading(false);
      },
    );
  }, [sessionName]);

  useEffect(() => {
    loadWindows();
  }, [loadWindows]);

  const switchToWindow = async (windowId: string, windowName: string) => {
    try {
      // 'switch-client' makes the client actually jump to the target session/window
      await runCommand(`tmux switch-client -t ${windowId}`);
      showToast({ title: `Switched to ${windowName}` });
    } catch (e) {
      handleError("Failed to switch window", e);
    }
  };

  const deleteWindow = async (windowId: string, windowName: string) => {
    if (
      await confirmAlert({
        title: "Delete Window",
        message: `Delete window "${windowName}"?`,
        primaryAction: { title: "Delete", style: Action.Style.Destructive },
      })
    ) {
      try {
        await runCommand(`tmux kill-window -t ${windowId}`);
        showToast({ title: "Deleted window" });
        loadWindows();
      } catch (e) {
        handleError("Failed to delete window", e);
      }
    }
  };

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`Windows: ${sessionName}`}
      searchBarPlaceholder="Search windows..."
      actions={
        <ActionPanel>
          <Action
            title="Create New Window"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["ctrl"], key: "n" }}
            onAction={() =>
              push(
                <CreateWindowForm
                  sessionName={sessionName}
                  onCreate={loadWindows}
                />,
              )
            }
          />
        </ActionPanel>
      }
    >
      {windows.map((win) => (
        <List.Item
          key={win.id}
          title={`${win.index}: ${win.name}`}
          icon={{
            source: win.active ? Icon.CheckCircle : Icon.Circle,
            tintColor: win.active ? Color.Green : Color.SecondaryText,
          }}
          accessories={[{ text: win.active ? "Active" : "" }]}
          actions={
            <ActionPanel>
              <Action
                title="Switch to Window"
                icon={Icon.ArrowRight}
                onAction={() => switchToWindow(win.id, win.name)}
              />
              <Action
                title="Rename Window"
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() =>
                  push(
                    <RenameWindowForm
                      sessionName={sessionName}
                      windowId={win.id}
                      currentName={win.name}
                      onRename={loadWindows}
                    />,
                  )
                }
              />
              <Action
                title="Delete Window"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "d" }}
                onAction={() => deleteWindow(win.id, win.name)}
              />
              <Action
                title="Create New Window"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["ctrl"], key: "n" }}
                onAction={() =>
                  push(
                    <CreateWindowForm
                      sessionName={sessionName}
                      onCreate={loadWindows}
                    />,
                  )
                }
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

// --- Forms ---

function CreateSessionForm({ onCreate }: { onCreate: () => void }) {
  const { pop } = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Session"
            onSubmit={async (values: { name: string; directory: string }) => {
              const name = values.name.trim();
              if (!name) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "Session name is required",
                });
                return;
              }

              const dir = values.directory?.trim() || "~";
              // Basic escaping for directory path
              const escapedDir = dir.replace(/(["'$`\\])/g, "\\$1");

              try {
                await runCommand(
                  `tmux new-session -d -s ${name} -c "${escapedDir}"`,
                );
                showToast({ title: `Created session ${name}` });
                onCreate();
                pop();
              } catch (e) {
                handleError("Failed to create session", e);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Session Name" placeholder="my-project" />
      <Form.TextField
        id="directory"
        title="Working Directory"
        placeholder="~"
        defaultValue="~"
      />
    </Form>
  );
}

function RenameSessionForm({
  currentName,
  onRename,
}: {
  currentName: string;
  onRename: () => void;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Rename Session"
            onSubmit={async (values: { name: string }) => {
              const newName = values.name.trim();
              if (!newName) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "Name required",
                });
                return;
              }

              try {
                await runCommand(
                  `tmux rename-session -t ${currentName} ${newName}`,
                );
                showToast({ title: "Renamed session" });
                onRename();
                pop();
              } catch (e) {
                handleError("Failed to rename", e);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="New Name"
        defaultValue={currentName}
        placeholder="New session name"
      />
    </Form>
  );
}

function CreateWindowForm({
  sessionName,
  onCreate,
}: {
  sessionName: string;
  onCreate: () => void;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Window"
            onSubmit={async (values: { name: string }) => {
              const name = values.name.trim();
              if (!name) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "Name required",
                });
                return;
              }

              try {
                await runCommand(
                  `tmux new-window -t ${sessionName} -n ${name}`,
                );
                showToast({ title: "Created window" });
                onCreate();
                pop();
              } catch (e) {
                handleError("Failed to create window", e);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Window Name" placeholder="Logs" />
    </Form>
  );
}

function RenameWindowForm({
  sessionName,
  windowId,
  currentName,
  onRename,
}: {
  sessionName: string;
  windowId: string;
  currentName: string;
  onRename: () => void;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Rename Window"
            onSubmit={async (values: { name: string }) => {
              const newName = values.name.trim();
              if (!newName) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "Name required",
                });
                return;
              }

              try {
                // Use windowId for reliable renaming
                await runCommand(
                  `tmux rename-window -t ${windowId} ${newName}`,
                );
                showToast({ title: "Renamed window" });
                onRename();
                pop();
              } catch (e) {
                handleError("Failed to rename", e);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="New Name"
        defaultValue={currentName}
        placeholder="New window name"
      />
    </Form>
  );
}
