import { exec, ExecException } from "child_process";
import { showToast, Toast } from "@vicinae/api";

export const runCommand = (command: string): Promise<string> => {
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

export const handleError = (title: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
};
