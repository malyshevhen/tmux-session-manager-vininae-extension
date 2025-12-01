import {
  Action,
  ActionPanel,
  Form,
  showToast,
  useNavigation,
  Toast,
} from "@vicinae/api";
import { createSession } from "../../lib/tmux";
import { handleError } from "../../lib/utils";

export default function CreateSessionForm({
  onCreate,
}: {
  onCreate: () => void;
}) {
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
                  title: "Name required",
                });
                return;
              }
              const dir = values.directory?.trim() || "~";

              try {
                await createSession(name, dir);
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
