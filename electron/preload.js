const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	getServerUrl: () => ipcRenderer.invoke("get-server-url"),
	normalizeServerUrl: (value) => ipcRenderer.invoke("normalize-server-url", value),
	setServerUrl: (value) => ipcRenderer.invoke("set-server-url", value),
	retryLoad: () => ipcRenderer.invoke("retry-load"),
	openSettings: () => ipcRenderer.invoke("open-settings"),
	probeServer: () => ipcRenderer.invoke("probe-server"),
	resetServer: () => ipcRenderer.invoke("reset-server"),
	getCustomerDisplay: () => ipcRenderer.invoke("get-customer-display"),
	setCustomerDisplay: (value) => ipcRenderer.invoke("set-customer-display", value),
	setupLockState: () => ipcRenderer.invoke("setup-lock-state"),
	setupCreatePassword: (value) => ipcRenderer.invoke("setup-create-password", value),
	setupUnlock: (value) => ipcRenderer.invoke("setup-unlock", value),
	setupChangePassword: (value) => ipcRenderer.invoke("setup-change-password", value),
});
