let processTime = 0;
let isNeedRecordTime = 0;
let fetchTime = 0;
let log = "";
let logCount = 0;
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
        saveTokenCheckbox = document.getElementById("saveTokenCheckbox"),
        togglePageIdVisibility = document.getElementById("togglePageIdVisibility"),
        toggleTokenVisibility = document.getElementById("toggleTokenVisibility"),
        problemBlock = document.getElementById("problemBlock");

  function updateBackground(isHighlighting) {
    document.body.style.background = isHighlighting
      ? "linear-gradient(120deg, #4A251B 0%, #7F4339 100%)"
      : "linear-gradient(120deg, rgb(61, 61, 61) 0%, rgb(0, 0, 0) 100%)";
  }

  function updateModeDisplay(mode) {
    currentModeP.textContent = "現在の状態：" + (mode === "highlighter" ? "ハイライト中" : "停止中");
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
                  const cleanDesc = refObj.description.replace(/\&\{[^}]+\}/g, "").replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_GREEN__【参】：　${refKey}: ${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            text = text.replace(/~\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description.replace(/\&\{[^}]+\}/g, "").replace(/\~\{[^}]+\}/g, "");
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
    let startCursor;
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
    fetchStatusEl.textContent = "データステータス：処理中...";
    try {
      const allBlocks = await fetchAllBlocks(storedPageId, notionToken);
      let notionJson = {};
      log = "";
      logCount = 0;
      if (Array.isArray(allBlocks)) {
        allBlocks.forEach(block => {
          if (
            block.type === "paragraph" &&
            block.paragraph &&
            block.paragraph.rich_text &&
            block.paragraph.rich_text.length > 0
          ) {
            const textContent = block.paragraph.rich_text.map(t => t.plain_text).join("");
            const parts = textContent.split('/');
            if (parts.length == 3) {
              const key = parts[0].trim();
              const subName = parts[1].trim();
              const description = parts.slice(2).join('/').trim();
              if(notionJson[key])
              {
                notionJson[key].description += "\n" + subName + "\n" + description;
              }
              else
              {
                notionJson[key] = { "sub-name": subName, "description": description };
              }
            }
            else
            {
              log = log + parts[0].trim()+"...\n";
              logCount++;
            }
          }
        });
      }
      problemBlock.textContent = "Wrong Block：" + logCount;
      notionJson = substitutePlaceholders(notionJson);
      fetchStatusEl.textContent = "データステータス：完成";
      return notionJson;
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      fetchStatusEl.textContent = "データステータス：失敗";
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
        fetchTime = Date.now();
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
    chrome.storage.local.set({ highlightColor: e.target.value }, sendHighlightMessage);
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
      keyCountElement.textContent = "0";
    });
  });

  refreshBtn.addEventListener("click", () => {
    isNeedRecordTime = 1;
    processTime = Date.now();
    updateHighlighter();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_FINISHED" && isNeedRecordTime) {
      const fetchDuration = fetchTime - processTime;
      const highlightDuration = Date.now() - fetchTime;
      elapsedTimeElement.textContent =
        "経過時間：Fetch: " + (fetchDuration / 1000).toFixed(2) + "秒, Tidy: " + (highlightDuration / 1000).toFixed(2) + "秒";
      isNeedRecordTime = 0;
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

  window.addEventListener("popstate", sendHighlightMessage);
  window.addEventListener("hashchange", sendHighlightMessage);

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

  togglePageIdVisibility.addEventListener("click", () => {
    const pageIdInput = document.getElementById("notionPageId");
    pageIdInput.type = pageIdInput.type === "password" ? "text" : "password";
    togglePageIdVisibility.textContent = "👁";
  });

  toggleTokenVisibility.addEventListener("click", () => {
    const tokenInput = document.getElementById("notionToken");
    tokenInput.type = tokenInput.type === "password" ? "text" : "password";
    toggleTokenVisibility.textContent = "👁";
  });

  // 在 popup.js 的 DOMContentLoaded 事件內新增以下程式碼
  
  if (problemBlock) {
    problemBlock.addEventListener("mouseover", (e) => {
      let tooltip = document.createElement("div");
      tooltip.id = "problemTooltip";
      tooltip.style.position = "absolute";
      tooltip.style.padding = "8px 12px";
      tooltip.style.background = "rgba(0, 0, 0, 0.8)";
      tooltip.style.color = "#fff";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "14px";
      tooltip.style.zIndex = "10000";
      tooltip.innerText = log;
      document.body.appendChild(tooltip);
      const rect = problemBlock.getBoundingClientRect();
      // 等待瀏覽器渲染 tooltip 後再計算寬度以置中
      const tooltipWidth = tooltip.offsetWidth;
      tooltip.style.left = (rect.left + (rect.width - tooltipWidth) / 2) + "px";
      tooltip.style.top = (rect.bottom + 5) + "px";
    });
    problemBlock.addEventListener("mouseout", () => {
      const tooltip = document.getElementById("problemTooltip");
      if (tooltip) tooltip.remove();
    });
  }

});
