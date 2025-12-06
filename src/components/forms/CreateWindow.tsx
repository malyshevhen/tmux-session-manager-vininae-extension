import {
	Action,
	ActionPanel,
	Form,
	showToast,
	useNavigation,
	Toast,
} from "@vicinae/api";
import { newWindow } from "../../lib/tmux";
import { handleError } from "../../lib/utils";

export default function CreateWindowForm({
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
						onSubmit={async (values) => {
							const name = String(values.name || "").trim();
							if (!name) {
								showToast({
									style: Toast.Style.Failure,
									title: "Name required",
								});
								return;
							}

							try {
								await newWindow(sessionName, name);
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
			<Form.TextField id="name" title="Window Name" />
		</Form>
	);
}
