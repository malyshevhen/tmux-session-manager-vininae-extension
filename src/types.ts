export type SessionInfo = {
  name: string;
  windowCount: number;
  attached: boolean;
  created: string;
  currentWindow: string;
  paneCount: number;
  lastAttached: number;
};

export type WindowInfo = {
  id: string;
  index: string;
  name: string;
  active: boolean;
  layout: string;
};
