// popup.js
let processTime = 0;
let isNeedRecordTime = 0;
document.addEventListener("DOMContentLoaded", () => {
  // 取得 DOM 元素
  const startModeBtn = document.getElementById("startModeBtn"),
        stopModeBtn = document.getElementById("stopModeBtn"),
        deleteStorageBtn = document.getElementById("deleteStorageBtn"),
        currentModeP = document.getElementById("currentMode"),
        currentDataSourceP = document.getElementById("currentDataSource"),
        keyCountElement = document.getElementById("keyCount"),
        refreshBtn = document.getElementById("refreshBtn"),
        elapsedTimeElement = document.getElementById("elapsedTime"),
        highlightColorInput = document.getElementById("highlightColor"),
        fetchNotionBtn = document.getElementById("fetchNotionBtn"),
        verifyBtn = document.getElementById("verifyBtn"),
        localHostInput = document.getElementById("localhostInput"),
        keyInput = document.getElementById("keyInput"),
        verifyResult = document.getElementById("verifyResult"),
        notionPageIdInput = document.getElementById("notionPageId"),
        fetchStatusEl = document.getElementById("fetchStatus");

  // 補回 updateModeDisplay
  function updateModeDisplay(mode) {
    currentModeP.textContent = "現在の状態：" + (mode === "highlighter" ? "ハイライト中" : "停止中");
  }

  // 更新資料來源顯示
  function updateDataSourceDisplay(mode) {
    currentDataSourceP.textContent = "データソース：" + mode;
  }

  // 更新 JSON 鍵數顯示
  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? "JSONキー数：" + keys.length : "0";
    });
  }

  // 佔位符及換行處理
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

  // 分頁取得所有區塊
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

  // 只用於刷新 / Fetch Notion Data 時才 fetch Notion
  async function fetchNotionData() {
    // 從 chrome.storage 讀取 Notion Page ID，若未儲存則使用預設值
    const storedPageId = await new Promise((resolve) => {
      chrome.storage.local.get("notionPageId", (result) => {
        resolve(result.notionPageId || config.apiPageID);
      });
    });
    // 請自行替換 notionToken 為你的值
    const notionToken = config.apiToken;
    // 更新狀態提示
    fetchStatusEl.textContent = "データステータス："+"処理中...";
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
      fetchStatusEl.textContent = "データステータス："+"完成";
      return notionJson;
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      fetchStatusEl.textContent = "データステータス："+"失敗";
      return null;
    }
  }

  // 僅傳送已儲存的 JSON 進行高亮
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

  // 「刷新」：僅 fetch Notion 資料並更新 storage，然後重新高亮
  async function updateHighlighter() {
    const newData = await fetchNotionData();
    if (newData) {
      chrome.storage.local.set({ jsonData: newData }, () => {
        sendHighlightMessage();
        updateKeyCount();
        updateModeDisplay("highlighter");
      });
    } else {
      updateKeyCount();
    }
  }

  // 初始將 dataSource 設為 Notion
  chrome.storage.local.set({ dataSource: "notion" }, () => {
    updateModeDisplay("highlighter");
    updateDataSourceDisplay("Notion");
    updateKeyCount();
  });

  // 在 popup 載入時，讀取 highlightColor 與 Notion Page ID
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
      // 預設值
      notionPageIdInput.value = config.apiPageID;
      chrome.storage.local.set({ notionPageId: notionPageIdInput.value });
    }
  });

  // 當使用者更改 Notion Page ID 時，更新 chrome.storage
  notionPageIdInput.addEventListener("change", (e) => {
    const newPageId = e.target.value.trim();
    chrome.storage.local.set({ notionPageId: newPageId });
  });

  // 當使用者改變高亮顏色，只用現有 JSON 更新
  highlightColorInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ highlightColor: e.target.value }, () => {
      sendHighlightMessage();
    });
  });

  // 「ハイライト開始」：若有 JSON 直接高亮，否則提示先 fetch
  startModeBtn.addEventListener("click", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) {
        sendHighlightMessage();
        updateModeDisplay("highlighter");
      } else {
        alert("JSONデータがありません。先に Notion から読み込んでください。");
      }
    });
  });

  // 「ハイライト停止」
  stopModeBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
    });
    updateModeDisplay("stopped");
  });

  // 「JSON削除」
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

  // 「刷新」按鈕：從 Notion fetch 資料
  refreshBtn.addEventListener("click", () => {
    isNeedRecordTime = 1;
    processTime = Date.now();
    updateHighlighter();
  });


  // 監聽 contentScript 回傳的高亮完成訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_FINISHED") {
      if(isNeedRecordTime)
      {
        const elapsedTime = Date.now() - processTime;
        elapsedTimeElement.textContent = "経過時間：" + Math.round(elapsedTime) + "ms";
        isNeedRecordTime = 0;
      }
    }
    sendResponse();
  });

  // Popup 載入時，若已有 JSON 就直接用舊資料高亮（不 fetch）
  window.addEventListener("load", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) {
        sendHighlightMessage();
      }
    });
  });

  // 其餘事件（popstate, hashchange）僅使用現有 JSON 更新高亮
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
});
