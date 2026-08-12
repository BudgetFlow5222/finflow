// Preload — runs in an isolated context with access to a limited Node API.
// Currently a no-op; the app talks to the Next.js server over HTTP so no
// privileged bridge is needed. Kept for future native integrations.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("finflow", {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
});
