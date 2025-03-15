let processTime = 0;
let isNeedRecordTime = 0;
document.addEventListener("DOMContentLoaded", () => {
  const toggleModeBtn = document.getElementById("toggleModeBtn"),
        deleteStorageBtn = document.getElementById("deleteStorageBtn"),
        refreshBtn = document.getElementById("refreshBtn"),
        currentModeP = document.getElementById("currentMode"),
        currentDataSourceP = document.getElementById("currentDataSource"),
        keyCountElement = document.getElementById("keyCount"),
        elapsedTimeElement = document.getElementById("elapsedTime"),
        highlightColorInput = document.getElementById("highlightColor"),
        notionPageIdInput = document.getElementById("notionPageId"),
        fetchStatusEl = document.getElementById("fetchStatus"),
        notionTokenInput = document.getElementById("notionToken"),
        saveTokenCheckbox = document.getElementById("saveTokenCheckbox");

  // 根據模式變更 popup 背景色
  function updateBackground(isHighlighting) {
    if (isHighlighting) {
      document.body.style.background = "linear-gradient(120deg, #4A251B 0%, #7F4339 100%)";
    } else {
      document.body.style.background = "linear-gradient(120deg,rgb(61, 61, 61) 0%,rgb(0, 0, 0) 100%)";
    }
  }

  function updateModeDisplay(mode) {
    currentModeP.textContent = "現在の状態：" + (mode === "highlighter" ? "ハイライト中" : "停止中");
  }

  function updateDataSourceDisplay(mode) {
    currentDataSourceP.textContent = "データソース：" + mode;
  }

  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? "JSONキー数：" + keys.length : "0";
    });
  }

  function substitutePlaceholders(originalJsonData) {
    const jsonData = JSON.parse(JSON.stringify(originalJsonData));
    Object.keys(jsonData).forEach(mainKey => {
      const obj = jsonData[mainKey];
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(prop => {
          let text = obj[prop];
          if (typeof text === "string") {
            text = text.replace(/&\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description
                    .replace(/\&\{[^}]+\}/g, "")
                    .replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_GREEN__【参】：　${refKey}: ${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            text = text.replace(/~\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description
                    .replace(/\&\{[^}]+\}/g, "")
                    .replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_RED__【似】：　${refKey}: ${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            text = text.replace(/@\{([^}]+)\}/g, (match, content) => {
              return `__PLACEHOLDER_BLUE__【例】：　${content}__ENDPLACEHOLDER__`;
            });
            text = text.replace(/\\n/g, "\n");
            obj[prop] = text;
          }
        });
      }
    });
    return jsonData;
  }

  async function fetchAllBlocks(pageId, notionToken) {
    let allBlocks = [];
    let hasMore = true;
    let startCursor = undefined;
    while (hasMore) {
      let url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
      if (startCursor) {
        url += `&start_cursor=${startCursor}`;
      }
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      allBlocks = allBlocks.concat(data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }
    return allBlocks;
  }

  async function fetchNotionData() {
    const storedPageId = await new Promise((resolve) => {
      chrome.storage.local.get("notionPageId", (result) => {
        resolve(result.notionPageId || config.apiPageID);
      });
    });
    const notionToken = notionTokenInput.value.trim();
    fetchStatusEl.textContent = "データステータス：" + "処理中...";
    try {
      const allBlocks = await fetchAllBlocks(storedPageId, notionToken);
      let notionJson = {};
      if (allBlocks && Array.isArray(allBlocks)) {
        allBlocks.forEach(block => {
          if (
            block.type === "paragraph" &&
            block.paragraph &&
            block.paragraph.rich_text &&
            block.paragraph.rich_text.length > 0
          ) {
            const textContent = block.paragraph.rich_text.map(t => t.plain_text).join("");
            const parts = textContent.split('/');
            if (parts.length >= 3) {
              const key = parts[0].trim();
              const subName = parts[1].trim();
              const description = parts.slice(2).join('/').trim();
              notionJson[key] = {
                "sub-name": subName,
                "description": description
              };
            }
          }
        });
      }
      notionJson = substitutePlaceholders(notionJson);
      fetchStatusEl.textContent = "データステータス：" + "完成";
      return notionJson;
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      fetchStatusEl.textContent = "データステータス：" + "失敗";
      return null;
    }
  }

  function sendHighlightMessage() {
    chrome.storage.local.get(["jsonData", "highlightColor"], (result) => {
      if (result.jsonData) {
        const keyValues = Object.entries(result.jsonData).map(([key, value]) => ({ key, value }));
        const highlightColor = result.highlightColor || highlightColorInput.value || "#ffff33";
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "HIGHLIGHT_BATCH",
              keyValues: keyValues,
              highlightColor: highlightColor
            });
          });
        });
      }
    });
  }

  async function updateHighlighter() {
    const newData = await fetchNotionData();
    if (newData) {
      chrome.storage.local.set({ jsonData: newData }, () => {
        sendHighlightMessage();
        updateKeyCount();
        updateModeDisplay("highlighter");
        updateBackground(true);
      });
    } else {
      updateKeyCount();
    }
  }

  chrome.storage.local.set({ dataSource: "notion" }, () => {
    updateModeDisplay("highlighter");
    updateDataSourceDisplay("Notion");
    updateKeyCount();
  });

  chrome.storage.local.get(["highlightColor", "notionPageId"], (res) => {
    if (res.highlightColor) {
      highlightColorInput.value = res.highlightColor;
    } else {
      highlightColorInput.value = "#ffff33";
      chrome.storage.local.set({ highlightColor: "#ffff33" });
    }
    if (res.notionPageId) {
      notionPageIdInput.value = res.notionPageId;
    } else {
      notionPageIdInput.value = config.apiPageID;
      chrome.storage.local.set({ notionPageId: notionPageIdInput.value });
    }
  });

  notionPageIdInput.addEventListener("change", (e) => {
    const newPageId = e.target.value.trim();
    chrome.storage.local.set({ notionPageId: newPageId });
  });

  highlightColorInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ highlightColor: e.target.value }, () => {
      sendHighlightMessage();
    });
  });

  toggleModeBtn.addEventListener("click", () => {
    if (toggleModeBtn.textContent === "開始高亮模式") {
      chrome.storage.local.get("jsonData", (result) => {
        if (result.jsonData) {
          sendHighlightMessage();
          updateModeDisplay("highlighter");
          toggleModeBtn.textContent = "停止高亮模式";
          updateBackground(true);
        } else {
          alert("JSONデータがありません。先に Notion から読み込んでください。");
        }
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      toggleModeBtn.textContent = "開始高亮模式";
      updateBackground(false);
    }
  });

  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["jsonData", "dataSource"], () => {
      alert("JSONデータを削除しました");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      currentDataSourceP.textContent = "データソース：なし";
      keyCountElement.textContent = "0";
    });
  });

  refreshBtn.addEventListener("click", () => {
    isNeedRecordTime = 1;
    processTime = Date.now();
    updateHighlighter();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_FINISHED") {
      if (isNeedRecordTime) {
        const elapsedTime = Date.now() - processTime;
        elapsedTimeElement.textContent = "経過時間：" + Math.round(elapsedTime) + "ms";
        isNeedRecordTime = 0;
      }
    }
    sendResponse();
  });

  window.addEventListener("load", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) {
        sendHighlightMessage();
      }
    });
  });

  window.addEventListener("popstate", () => {
    sendHighlightMessage();
  });
  window.addEventListener("hashchange", () => {
    sendHighlightMessage();
  });

  (function(history) {
    const pushState = history.pushState;
    history.pushState = function(state) {
      const ret = pushState.apply(history, arguments);
      window.dispatchEvent(new Event("popstate"));
      return ret;
    };
  })(window.history);

  chrome.storage.local.get("notionToken", (res) => {
    if (res.notionToken) {
      notionTokenInput.value = res.notionToken;
      saveTokenCheckbox.checked = true;
    } else {
      notionTokenInput.value = "";
      saveTokenCheckbox.checked = false;
    }
  });

  saveTokenCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      chrome.storage.local.set({ notionToken: notionTokenInput.value.trim() });
    } else {
      chrome.storage.local.remove("notionToken");
    }
  });

  notionTokenInput.addEventListener("change", (e) => {
    if (saveTokenCheckbox.checked) {
      chrome.storage.local.set({ notionToken: e.target.value.trim() });
    }
  });

  // 初始化背景顏色，根據是否有 JSON 數據決定模式
  chrome.storage.local.get("jsonData", (result) => {
    if (result.jsonData) {
      toggleModeBtn.textContent = "停止高亮模式";
      updateModeDisplay("highlighter");
      updateBackground(true);
    } else {
      toggleModeBtn.textContent = "開始高亮模式";
      updateModeDisplay("stopped");
      updateBackground(false);
    }
  });
});
