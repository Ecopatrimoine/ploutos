const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("feedbackAPI", {
  sendFeedback: (payload) => ipcRenderer.invoke("send-feedback", payload),
});
