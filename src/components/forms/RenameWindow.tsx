import {
	Action,
	ActionPanel,
	Form,
	showToast,
	useNavigation,
	Toast,
} from "@vicinae/api";
import { renameWindow } from "../../lib/tmux";
import { handleError } from "../../lib/utils";

export default function RenameWindowForm({
	windowId,
	currentName,
	onRename,
}: {
	// sessionName is not needed if we target by ID, but can be passed if needed for logging
	sessionName?: string;
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
						onSubmit={async (values) => {
							const newName = String(values.name || "").trim();
							if (!newName) {
								showToast({
									style: Toast.Style.Failure,
									title: "Name required",
								});
								return;
							}

							if (newName === currentName) {
								pop();
								return;
							}

							try {
								// Using windowId ensures we rename the specific window
								// even if there are duplicate names
								await renameWindow(windowId, newName);
								showToast({ title: "Renamed window" });
								onRename();
								pop();
							} catch (e) {
								handleError("Failed to rename window", e);
							}
						}}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField id="name" title="New Name" defaultValue={currentName} />
		</Form>
	);
}
