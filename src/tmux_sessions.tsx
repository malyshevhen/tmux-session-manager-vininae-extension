import {
  Action,
  ActionPanel,
  Icon,
  List,
  showToast,
  useNavigation,
  confirmAlert,
  Color,
} from "@vicinae/api";
import { useEffect, useState, useCallback } from "react";
import { SessionInfo } from "./types";
import { getSessions, switchClient, killSession } from "./lib/tmux";
import { handleError } from "./lib/utils";
import WindowList from "./components/WindowList";
import CreateSessionForm from "./components/forms/CreateSession";
import RenameSessionForm from "./components/forms/RenameSession";

export default function TmuxSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  const loadSessions = useCallback(async () => {
    // Note: getSessions handles the sorting logic internally now
    const data = await getSessions();
    setSessions(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const handleSwitch = async (name: string) => {
    try {
      await switchClient(name);
      showToast({ title: `Switched to ${name}` });
      loadSessions();
    } catch (e) {
      handleError("Failed to switch", e);
    }
  };

  const handleDelete = async (name: string) => {
    if (
      await confirmAlert({
        title: "Delete Session",
        message: `Delete "${name}"?`,
        primaryAction: { title: "Delete", style: Action.Style.Destructive },
      })
    ) {
      try {
        await killSession(name);
        showToast({ title: "Deleted session" });
        loadSessions();
      } catch (e) {
        handleError("Failed to delete", e);
      }
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search TMUX sessions...">
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
                  onAction={() => handleSwitch(session.name)}
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
                  onAction={() => handleDelete(session.name)}
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
