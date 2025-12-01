import { Action, ActionPanel, Icon, List, showToast, Form, useNavigation, confirmAlert } from "@vicinae/api";
import { useEffect, useState, useCallback } from "react";
import { exec } from "child_process";

type SessionInfo = {
	name: string;
	windows: string[];
	attached: boolean;
	created: string;
	currentWindow: string;
	paneCount: number;
};

export default function TmuxSessions() {
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { push } = useNavigation();

	const loadSessions = useCallback(() => {
		setIsLoading(true);
		exec("tmux list-sessions 2>/dev/null | awk '{print $1}' | sed 's/://'", (error, stdout) => {
			if (error) {
				showToast({ title: "Failed to load TMUX sessions", message: "Make sure TMUX is installed and running" });
				setIsLoading(false);
				return;
			}

			const sessionNames = stdout.trim().split('\n').filter(s => s.length > 0);

			// Load detailed info for each session
			const sessionPromises = sessionNames.map(sessionName => {
				return new Promise<SessionInfo>((resolve) => {
					// Get windows
					exec(`tmux list-windows -t ${sessionName} 2>/dev/null | awk '{print $2}'`, (winError, winStdout) => {
						const windows = winError
							? []
							: winStdout.trim().split('\n').filter(w => w.length > 0);

						// Get session details
						exec(`tmux display-message -p -t ${sessionName} "#{session_attached},#{session_created},#{window_name},#{session_panes}" 2>/dev/null`, (detailError, detailStdout) => {
							let attached = false;
							let created = '';
							let currentWindow = '';
							let paneCount = 0;

							if (!detailError && detailStdout.trim()) {
								const details = detailStdout.trim().split(',');
								attached = details[0] === '1';
								created = details[1] || '';
								currentWindow = details[2] || '';
								paneCount = parseInt(details[3]) || 0;
							}

							resolve({
								name: sessionName,
								windows,
								attached,
								created,
								currentWindow,
								paneCount
							});
						});
					});
				});
			});

			Promise.all(sessionPromises).then(sessionInfos => {
				setSessions(sessionInfos);
				setIsLoading(false);
			});
		});
	}, []);

	useEffect(() => {
		loadSessions();

		// Auto-refresh every 10 seconds
		const interval = setInterval(loadSessions, 10000);

		return () => clearInterval(interval);
	}, [loadSessions]);

	const switchToSession = (session: SessionInfo) => {
		exec(`tmux switch -t ${session.name}`, (error) => {
			if (error) {
				showToast({ title: "Failed to switch session", message: error.message });
			} else {
				showToast({ title: `Switched to session ${session.name}` });
			}
		});
	};

	const deleteSession = async (session: SessionInfo) => {
		const confirmed = await confirmAlert({
			title: "Delete Session",
			message: `Are you sure you want to delete the session "${session.name}"? This action cannot be undone.`,
			primaryAction: {
				title: "Delete"
			}
		});

		if (!confirmed) return;

		exec(`tmux kill-session -t ${session.name}`, (error) => {
			if (error) {
				showToast({ title: "Failed to delete session", message: error.message });
			} else {
				showToast({ title: `Deleted session ${session.name}` });
				loadSessions();
			}
		});
	};

	const createNewSession = (sessionName: string, directory: string = "~") => {
		const escapedDir = directory.replace(/ /g, '\\ ');
		exec(`tmux new-session -d -s ${sessionName} -c ${escapedDir}`, (error) => {
			if (error) {
				showToast({ title: "Failed to create session", message: error.message });
			} else {
				showToast({ title: `Created session ${sessionName}` });
				loadSessions();
			}
		});
	};

	return (
		<List
			isLoading={isLoading}
			searchBarPlaceholder="Search TMUX sessions..."
			actions={
				<ActionPanel>
					<Action
						title="Refresh Sessions"
						icon={Icon.ArrowClockwise}
						onAction={loadSessions}
						shortcut={{ modifiers: ["cmd"], key: "r" }}
					/>
				</ActionPanel>
			}
		>
			<List.Section title="TMUX Sessions">
				{sessions.map((session) => (
					<List.Item
						key={session.name}
						title={session.name}
						subtitle={`${session.windows.length} window${session.windows.length === 1 ? '' : 's'} • ${session.paneCount} pane${session.paneCount === 1 ? '' : 's'}`}
						icon={session.attached ? Icon.Terminal : Icon.Circle}
						accessories={[
							{ text: session.attached ? 'Attached' : 'Detached' },
							...(session.currentWindow ? [{ text: session.currentWindow }] : [])
						]}
						detail={
							<List>
								<List.Section title={`Session: ${session.name} ${session.attached ? '(Attached)' : '(Detached)'}`}>
									<List.Item
										title={`Current Window: ${session.currentWindow || 'None'}`}
										icon={Icon.Window}
									/>
									<List.Item
										title={`Total Panes: ${session.paneCount}`}
										icon={Icon.Circle}
									/>
									{session.created && (
										<List.Item
											title={`Created: ${new Date(parseInt(session.created) * 1000).toLocaleString()}`}
											icon={Icon.Clock}
										/>
									)}
								</List.Section>
								{session.windows.length > 0 && (
									<List.Section title={`Windows (${session.windows.length})`}>
										{session.windows.map((window, index) => (
											<List.Item
												key={index}
												title={window}
												icon={Icon.Window}
											/>
										))}
									</List.Section>
								)}
							</List>
						}
						actions={
							<ActionPanel>
								<Action
									title="Switch to Session"
									onAction={() => switchToSession(session)}
									icon={Icon.ArrowRight}
								/>
								<Action
									title="Rename Session"
									onAction={() => push(<RenameSessionForm currentName={session.name} onRename={loadSessions} />)}
									icon={Icon.Pencil}
									shortcut={{ modifiers: ["cmd"], key: "r" }}
								/>
								<Action
									title="Delete Session"
									onAction={() => deleteSession(session)}
									icon={Icon.Trash}
									shortcut={{ modifiers: ["ctrl"], key: "d" }}
									style={Action.Style.Destructive}
								/>
							</ActionPanel>
						}
					/>
				))}
				<List.Item
					title="Create New Session"
					icon={Icon.Plus}
					actions={
						<ActionPanel>
							<Action
								title="Create Session"
								onAction={() => push(<CreateSessionForm onCreate={loadSessions} />)}
								icon={Icon.Plus}
								shortcut={{ modifiers: ["cmd"], key: "n" }}
							/>
						</ActionPanel>
					}
				/>
			</List.Section>
		</List>
	);
}

function CreateSessionForm({ onCreate }: { onCreate: () => void }) {
	const { pop } = useNavigation();

	const validateSessionName = (name: string): boolean => {
		if (!name || name.trim().length === 0) {
			showToast({ title: "Session name is required" });
			return false;
		}
		if (name.includes(' ') || name.includes('\t')) {
			showToast({ title: "Session name cannot contain spaces" });
			return false;
		}
		if (name.length > 50) {
			showToast({ title: "Session name is too long (max 50 characters)" });
			return false;
		}
		return true;
	};

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm
						title="Create Session"
						onSubmit={(values) => {
							const sessionName = (values as { name?: string; directory?: string }).name?.trim();
							const directory = (values as { name?: string; directory?: string }).directory?.trim() || "~";

							if (!validateSessionName(sessionName || '')) {
								return;
							}

							const escapedDir = directory.replace(/ /g, '\\ ');
							exec(`tmux new-session -d -s ${sessionName} -c ${escapedDir}`, (error) => {
								if (error) {
									showToast({ title: "Failed to create session", message: error.message });
								} else {
									showToast({ title: `Created session ${sessionName}` });
									onCreate();
									pop();
								}
							});
						}}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField
				id="name"
				title="Session Name"
			/>
			<Form.TextField
				id="directory"
				title="Working Directory"
			/>
		</Form>
	);
}

function RenameSessionForm({ currentName, onRename }: { currentName: string; onRename: () => void }) {
	const { pop } = useNavigation();

	const validateSessionName = (name: string): boolean => {
		if (!name || name.trim().length === 0) {
			showToast({ title: "New session name is required" });
			return false;
		}
		if (name.includes(' ') || name.includes('\t')) {
			showToast({ title: "Session name cannot contain spaces" });
			return false;
		}
		if (name.length > 50) {
			showToast({ title: "Session name is too long (max 50 characters)" });
			return false;
		}
		return true;
	};

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm
						title="Rename Session"
						onSubmit={(values) => {
							const newName = (values as { name?: string }).name?.trim();

							if (!validateSessionName(newName || '')) {
								return;
							}

							if (newName === currentName) {
								showToast({ title: "New name must be different from current name" });
								return;
							}

							exec(`tmux rename-session -t ${currentName} ${newName}`, (error) => {
								if (error) {
									showToast({ title: "Failed to rename session", message: error.message });
								} else {
									showToast({ title: `Renamed session to ${newName}` });
									onRename();
									pop();
								}
							});
						}}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField
				id="name"
				title="New Session Name"
			/>
		</Form>
	);
}
