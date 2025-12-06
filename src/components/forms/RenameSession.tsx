import {
	Action,
	ActionPanel,
	Form,
	showToast,
	useNavigation,
	Toast,
} from "@vicinae/api";
import { renameSession } from "../../lib/tmux";
import { handleError } from "../../lib/utils";

export default function RenameSessionForm({
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
								await renameSession(currentName, newName);
								showToast({ title: "Renamed session" });
								onRename();
								pop();
							} catch (e) {
								handleError("Failed to rename session", e);
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
