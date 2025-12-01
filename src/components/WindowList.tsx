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
import { WindowInfo } from "../types";
import { getWindows, switchClient, killWindow } from "../lib/tmux";
import { handleError } from "../lib/utils";
import CreateWindowForm from "./forms/CreateWindow";
import RenameWindowForm from "./forms/RenameWindow";

export default function WindowList({ sessionName }: { sessionName: string }) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  // --- Data Loading ---

  const loadWindows = useCallback(async () => {
    try {
      // Don't set isLoading(true) here to prevent flickering on auto-refresh
      const data = await getWindows(sessionName);
      setWindows(data);
      setIsLoading(false);
    } catch (e) {
      handleError("Error loading windows", e);
      setIsLoading(false);
    }
  }, [sessionName]);

  // Initial load + Polling
  useEffect(() => {
    loadWindows();
    // Refresh frequently to capture active window changes
    const interval = setInterval(loadWindows, 2000);
    return () => clearInterval(interval);
  }, [loadWindows]);

  // --- Actions ---

  const handleSwitch = async (windowId: string, windowName: string) => {
    try {
      // Switches the attached client to this specific window
      await switchClient(windowId);
      showToast({ title: `Switched to ${windowName}` });
      loadWindows(); // Immediate refresh to update the "Active" icon
    } catch (e) {
      handleError("Failed to switch window", e);
    }
  };

  const handleDelete = async (windowId: string, windowName: string) => {
    if (
      await confirmAlert({
        title: "Delete Window",
        message: `Are you sure you want to delete window "${windowName}"?`,
        primaryAction: { title: "Delete", style: Action.Style.Destructive },
      })
    ) {
      try {
        await killWindow(windowId);
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
                onAction={() => handleSwitch(win.id, win.name)}
              />
              <Action
                title="Rename Window"
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() =>
                  push(
                    <RenameWindowForm
                      sessionName={sessionName} // Optional: for context logging if needed
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
                onAction={() => handleDelete(win.id, win.name)}
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
