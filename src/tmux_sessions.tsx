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
  lastAttached: number; // Added to track usage time
};

type WindowInfo = {
  id: string;
  index: string;
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
    // Format: name ||| windows ||| attached ||| created ||| active_window_name ||| panes ||| last_attached
    const format =
      "#{session_name}|||#{session_windows}|||#{session_attached}|||#{session_created}|||#{window_name}|||#{session_panes}|||#{session_last_attached}";

    exec(`tmux list-sessions -F "${format}" 2>/dev/null`, (error, stdout) => {
      if (error) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      const lines = stdout.trim().split("\n");
      const parsedSessions: SessionInfo[] = lines
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          const parts = line.split("|||");
          const name = parts[0];
          const windowCount = parseInt(parts[1]) || 0;
          const attached = parts[2] === "1";
          const created = parts[3];
          const currentWindow = parts[4];
          const paneCount = parseInt(parts[5]) || 0;
          // session_last_attached might be empty if never attached
          const lastAttached = parseInt(parts[6]) || 0;

          return {
            name,
            windowCount,
            attached,
            created,
            currentWindow,
            paneCount,
            lastAttached,
          };
        });

      // SORTING LOGIC:
      // 1. Attached sessions first
      // 2. Most recently attached (descending time)
      parsedSessions.sort((a, b) => {
        if (a.attached !== b.attached) {
          return a.attached ? -1 : 1; // Attached goes first
        }
        return b.lastAttached - a.lastAttached; // Newer timestamp goes first
      });

      setSessions(parsedSessions);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const switchToSession = async (sessionName: string) => {
    try {
      await runCommand(`tmux switch-client -t ${sessionName}`);
      showToast({ title: `Switched to ${sessionName}` });
      loadSessions();
    } catch (e) {
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
              {
                text: session.lastAttached
                  ? new Date(session.lastAttached * 1000).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : "",
                tooltip: "Last attached",
              },
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
    const format =
      "#{window_id}|||#{window_index}|||#{window_name}|||#{window_active}|||#{window_layout}";

    exec(
      `tmux list-windows -t ${sessionName} -F "${format}" 2>/dev/null`,
      (error, stdout) => {
        if (error) {
          handleError("Error loading windows", error);
          setIsLoading(false);
          return;
        }

        const lines = stdout.trim().split("\n");
        const parsedWindows: WindowInfo[] = lines
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

        setWindows(parsedWindows);
        setIsLoading(false);
      },
    );
  }, [sessionName]);

  useEffect(() => {
    loadWindows();
    const interval = setInterval(loadWindows, 2000);
    return () => clearInterval(interval);
  }, [loadWindows]);

  const switchToWindow = async (windowId: string, windowName: string) => {
    try {
      await runCommand(`tmux switch-client -t ${windowId}`);
      showToast({ title: `Switched to ${windowName}` });
      loadWindows();
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
