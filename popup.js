let processTime = 0;
let isNeedRecordTime = 0;
let fetchTime = 0;
let log = "No problem in your notion blocks";
let logCount = 0;

document.addEventListener("DOMContentLoaded", () => {
  const toggleModeBtn = document.getElementById("toggleModeBtn"),
        deleteStorageBtn = document.getElementById("deleteStorageBtn"),
        refreshBtn = document.getElementById("refreshBtn"),
        currentModeP = document.getElementById("currentMode"),
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
    currentModeP.textContent = "Current Mode：" + (mode === "highlighter" ? "Highlighting" : "Stop");
  }

  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? "Block Number：" + keys.length : "0";
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
                  const cleanSubName = refObj["sub-name"];
                  if (cleanSubName) {
                    return `__PLACEHOLDER_GREEN__【※】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanSubName}<br>${cleanDesc}__ENDPLACEHOLDER__`;
                  } else {
                    return `__PLACEHOLDER_GREEN__【※】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`;
                  }
                }
              }
              return refKey;
            });
            text = text.replace(/~\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description.replace(/\&\{[^}]+\}/g, "").replace(/\~\{[^}]+\}/g, "");
                  const cleanSubName = refObj["sub-name"];
                  if (cleanSubName) {
                    return `__PLACEHOLDER_RED__【！】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanSubName}<br>${cleanDesc}__ENDPLACEHOLDER__`;
                  } else {
                    return `__PLACEHOLDER_RED__【！】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`;
                  }
                }
              }
              return refKey;
            });
            text = text.replace(/@\{([^}]+)\}/g, (match, content) => {
              return `__PLACEHOLDER_BLUE__【e.g.】: ${content}__ENDPLACEHOLDER__`;
            });
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
    fetchStatusEl.textContent = "Data Status：Processing...";

    try {
      const allBlocks = await fetchAllBlocks(storedPageId, notionToken);
      let notionJson = {};
      log = "No problem in your notion blocks";
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
            if (parts.length === 3) {
              const key = parts[0].trim();
              const subName = parts[1].trim();
              const description = parts.slice(2).join('/').trim();
              if(notionJson[key]) {
                notionJson[key].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>`;
                notionJson[key].description += subName + "\n" + description;
              } else {
                notionJson[key] = { "sub-name": subName, "description": description };
              }
            } else {
              if(logCount === 0) {
                log = "Please check your notion blocks！";
                log+= `<div style=\"border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;\"></div>`;
              }
              log = log + parts[0].trim()+"...<br>";
              logCount++;
            }
          }
        });
      }

      problemBlock.textContent = "Wrong Block：" + logCount;
      notionJson = substitutePlaceholders(notionJson);
      fetchStatusEl.textContent = "Data Status：Finish";
      return notionJson;
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      fetchStatusEl.textContent = "Data Status：Fail";
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

  // 預設就嘗試載入並顯示
  updateModeDisplay("highlighter");
  updateKeyCount();

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
    if (toggleModeBtn.textContent === "Highlight！") {
      chrome.storage.local.get("jsonData", (result) => {
        if (result.jsonData) {
          sendHighlightMessage();
          updateModeDisplay("highlighter");
          toggleModeBtn.textContent = "Stop";
          updateBackground(true);
        } else {
          alert("No data. Please click refresh button to load it from Notion.");
        }
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      toggleModeBtn.textContent = "Highlight！";
      updateBackground(false);
    }
  });

  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["jsonData"], () => {
      alert("Data was deleted");
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
      const totalSec = (fetchDuration + highlightDuration) / 1000;
      elapsedTimeElement.textContent = "Process Time：" + totalSec.toFixed(2) + "s";
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
      toggleModeBtn.textContent = "Stop";
      updateModeDisplay("highlighter");
      updateBackground(true);
    } else {
      toggleModeBtn.textContent = "Highlight！";
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
      tooltip.innerHTML = log;
      document.body.appendChild(tooltip);
      const rect = problemBlock.getBoundingClientRect();
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
