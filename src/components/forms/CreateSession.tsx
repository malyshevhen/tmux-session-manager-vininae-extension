import {
  Action,
  ActionPanel,
  Form,
  showToast,
  useNavigation,
  Toast,
  Icon,
} from "@vicinae/api";
import { createSession } from "../../lib/tmux";
import { handleError } from "../../lib/utils";
import { getPathSuggestions, PathSuggestion } from "../../lib/pathSuggestions";
import { useState, useEffect, useCallback } from "react";

export default function CreateSessionForm({
  onCreate,
}: {
  onCreate: () => void;
}) {
  const { pop } = useNavigation();
  const [suggestions, setSuggestions] = useState<PathSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSuggestions("");
  }, []);

  const loadSuggestions = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const pathSuggestions = await getPathSuggestions(query);
      setSuggestions(pathSuggestions);
    } catch (e) {
      console.error("Failed to load suggestions:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchTextChange = useCallback(
    (text: string) => {
      loadSuggestions(text);
    },
    [loadSuggestions],
  );

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Session"
            onSubmit={async (values) => {
              const name = String(values.name || "").trim();
              if (!name) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "Name required",
                });
                return;
              }
              const dir = String(values.directory || "~").trim();

              try {
                await createSession(name, dir);
                showToast({ title: `Created session ${name} in ${dir}` });

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
      <Form.TextField id="name" title="Session Name" defaultValue="" />
      <Form.Dropdown
        id="directory"
        title="Working Directory"
        defaultValue="~"
        filtering={false}
        throttle={true}
        onSearchTextChange={handleSearchTextChange}
        isLoading={isLoading}
      >
        <Form.Dropdown.Item
          value="~"
          title="Home Directory (~)"
          icon={Icon.Folder}
        />
        {suggestions.map((suggestion) => (
          <Form.Dropdown.Item
            key={suggestion.path}
            value={suggestion.path}
            title={suggestion.name}
            icon={Icon.Folder}
            keywords={[suggestion.name, suggestion.path]}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
