let processTime = 0;
let isNeedRecordTime = 0;
let fetchTime = 0;
let currentDbIndex = 0; // 目前顯示的資料庫索引

document.addEventListener("DOMContentLoaded", () => {
  const toggleModeBtn = document.getElementById("toggleModeBtn");
  const deleteStorageBtn = document.getElementById("deleteStorageBtn");
  const currentModeP = document.getElementById("currentMode");
  const highlightColorInput = document.getElementById("highlightColor");
  const splitCharInput = document.getElementById("splitChar");
  const addDbBtn = document.getElementById("addDbBtn");

  // 與 Token 相關 DOM
  const notionTokenInput = document.getElementById("notionToken");
  const toggleTokenVisibility = document.getElementById("toggleTokenVisibility");
  const saveTokenCheckbox = document.getElementById("saveTokenCheckbox");

  // 單一資料庫顯示區 DOM
  const dbDisplay = document.getElementById("dbDisplay");
  const prevDbBtn = document.getElementById("prevDbBtn");
  const nextDbBtn = document.getElementById("nextDbBtn");
  //const dbIndexIndicator = document.getElementById("dbIndexIndicator");

  // ========== 初始化：Token、SplitChar、HighlightColor ==========
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
  toggleTokenVisibility.addEventListener("click", () => {
    notionTokenInput.type = notionTokenInput.type === "password" ? "text" : "password";
    toggleTokenVisibility.textContent = "👁";
  });
  chrome.storage.local.get(["splitChar"], (res) => {
    if (res.splitChar) {
      splitCharInput.value = res.splitChar;
    } else {
      splitCharInput.value = "/";
      chrome.storage.local.set({ splitChar: "/" });
    }
  });
  splitCharInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ splitChar: e.target.value });
  });
  chrome.storage.local.get(["highlightColor"], (res) => {
    if (res.highlightColor) {
      highlightColorInput.value = res.highlightColor;
    } else {
      highlightColorInput.value = "#ffff33";
      chrome.storage.local.set({ highlightColor: "#ffff33" });
    }
  });
  highlightColorInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ highlightColor: e.target.value }, sendHighlightMessageForAll);
  });

  // ========== 單一資料庫顯示區 ==========
  function renderCurrentDb() {
    chrome.storage.local.get("notionDatabases", (res) => {
      let notionDatabases = res.notionDatabases || [];
      // 確保至少有一組資料庫
      if (!notionDatabases.length) {
        notionDatabases = [{
          id: Date.now().toString(),
          pageId: "",
          pageTitle: "",
          jsonData: {},
          latestStats: null
        }];
        chrome.storage.local.set({ notionDatabases });
        currentDbIndex = 0;
      }
      // 初次若 currentDbIndex = -1，則表示從尾端開始
      if (currentDbIndex === -1) {
        currentDbIndex = notionDatabases.length - 1;
      }
      if (currentDbIndex < 0) currentDbIndex = 0;
      if (currentDbIndex >= notionDatabases.length) currentDbIndex = notionDatabases.length - 1;
      const total = notionDatabases.length;
      const currentNum = currentDbIndex + 1;
      // 更新索引指示器
      //dbIndexIndicator.textContent = `${currentNum}/${total}`;
      const dbItem = notionDatabases[currentDbIndex];
      const showTitle = dbItem.pageTitle ? dbItem.pageTitle : `Database #${currentNum}`;
      const html = `
        <h1 style="font-size:15px;">${showTitle}</h1>
        <label class="info-line">Page ID：</label><br>
        <input type="text" class="pageIdInput styled-input" style="margin-top:10px;" value="${dbItem.pageId}" data-id="${dbItem.id}" />
        <br>
        <br>
        ${renderStatsInfo(dbItem)}
        <button class="refreshDbBtn" data-id="${dbItem.id}" style="margin-top:10px;">Refresh</button>
        <button class="deleteDbBtn" data-id="${dbItem.id}" style="margin-top:10px;">Delete</button>
        <br><br>
        <span style="font-size:14px;">${currentNum}/${total}</span>
      `;
      dbDisplay.innerHTML = html;
      bindDbEvents();
      updateNavButtons(total);
    });
  }

  function renderStatsInfo(dbItem) {
    const stats = dbItem.latestStats;
    if (!stats) {
      return `
        <p class="info-line" id="status_${dbItem.id}">Data Status：None</p>
        <p class="info-line" id="elapsedTime_${dbItem.id}">Runtime：0ms</p>
        <p class="info-line" id="keyCount_${dbItem.id}">Block Number：0</p>
        <p class="info-line" id="problemBlock_${dbItem.id}">Wrong Block：0</p>
      `;
    } else {
      return `
        <p class="info-line" id="status_${dbItem.id}">Data Status：${stats.dataStatus}</p>
        <p class="info-line" id="elapsedTime_${dbItem.id}">Runtime：${stats.runTime.toFixed(2)}s</p>
        <p class="info-line" id="keyCount_${dbItem.id}">Block Number：${stats.blockCount}</p>
        <p class="info-line" id="problemBlock_${dbItem.id}">Wrong Block：${stats.problemCount}</p>
      `;
    }
  }

  function bindDbEvents() {
    const pageIdInput = dbDisplay.querySelector(".pageIdInput");
    if (pageIdInput) {
      pageIdInput.addEventListener("change", (e) => {
        const changedId = e.target.dataset.id;
        chrome.storage.local.get("notionDatabases", (res) => {
          const notionDatabases = res.notionDatabases || [];
          const findItem = notionDatabases.find(x => x.id === changedId);
          if (findItem) {
            findItem.pageId = e.target.value.trim();
            chrome.storage.local.set({ notionDatabases });
          }
        });
      });
    }
    const refreshBtn = dbDisplay.querySelector(".refreshDbBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        const dbId = refreshBtn.dataset.id;
        const statusEl = document.getElementById(`status_${dbId}`);
        if (statusEl) statusEl.textContent = "Data Status：Processing...";
        // 先從輸入框取得最新 Page ID，並同步更新 storage
        const pageIdInput = dbDisplay.querySelector(".pageIdInput");
        if (pageIdInput) {
          const newPageId = pageIdInput.value.trim();
          const storageData = await new Promise(resolve => chrome.storage.local.get("notionDatabases", resolve));
          let notionDatabases = storageData.notionDatabases || [];
          const targetDb = notionDatabases.find(x => x.id === dbId);
          if (targetDb) {
            targetDb.pageId = newPageId;
            await new Promise(resolve => chrome.storage.local.set({ notionDatabases }, resolve));
          }
        }
        const startTime = performance.now();
        const success = await fetchSingleNotion(dbId, startTime);
        if (success) {
          fetchTime = Date.now();
          if (!isNeedRecordTime) {
            isNeedRecordTime = 1;
            processTime = Date.now();
          }
          sendHighlightMessageForAll();
        }
        renderCurrentDb();
      });
    }
    const deleteBtn = dbDisplay.querySelector(".deleteDbBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const delId = deleteBtn.dataset.id;
        chrome.storage.local.get("notionDatabases", (res) => {
          let notionDatabases = res.notionDatabases || [];
          if (notionDatabases.length === 1) {
            alert("無法刪除，至少需保留一組資料庫！");
            return;
          }
          notionDatabases = notionDatabases.filter(x => x.id !== delId);
          if (currentDbIndex >= notionDatabases.length) {
            currentDbIndex = notionDatabases.length - 1;
          }
          chrome.storage.local.set({ notionDatabases }, () => {
            renderCurrentDb();
          });
        });
      });
    }
    const problemBlockP = dbDisplay.querySelector(`#problemBlock_${pageIdInput?.dataset.id}`);
    if (problemBlockP) {
      problemBlockP.addEventListener("mouseover", () => {
        chrome.storage.local.get("notionDatabases", (res) => {
          const notionDatabases = res.notionDatabases || [];
          const dbItem = notionDatabases.find(x => x.id === pageIdInput.dataset.id);
          if (!dbItem || !dbItem.latestStats || !dbItem.latestStats.problemBlockList?.length) return;
          let tooltip = document.createElement("div");
          tooltip.id = `problemTooltip_${dbItem.id}`;
          tooltip.style.position = "absolute";
          tooltip.style.padding = "8px 12px";
          tooltip.style.background = "rgba(0, 0, 0, 0.8)";
          tooltip.style.color = "#fff";
          tooltip.style.borderRadius = "4px";
          tooltip.style.fontSize = "14px";
          tooltip.style.zIndex = "10000";
          tooltip.innerHTML = dbItem.latestStats.problemBlockList.join("<br>");
          dbDisplay.appendChild(tooltip);
          const rect = problemBlockP.getBoundingClientRect();
          const dispRect = dbDisplay.getBoundingClientRect();
          tooltip.style.left = (rect.left - dispRect.left) + "px";
          tooltip.style.top = (rect.bottom - dispRect.top + 5) + "px";
        });
      });
      problemBlockP.addEventListener("mouseout", () => {
        const tooltip = dbDisplay.querySelector(`#problemTooltip_${pageIdInput?.dataset.id}`);
        if (tooltip) tooltip.remove();
      });
    }
  }

  function updateNavButtons(total) {
    prevDbBtn.disabled = (currentDbIndex <= 0);
    nextDbBtn.disabled = (currentDbIndex >= total - 1);
  }

  // ========== 多資料庫操作：新增、刪除全部 ==========
  addDbBtn.addEventListener("click", () => {
    chrome.storage.local.get("notionDatabases", (res) => {
      let notionDatabases = res.notionDatabases || [];
      notionDatabases.push({
        id: Date.now().toString(),
        pageId: "",
        pageTitle: "",
        jsonData: {},
        latestStats: null
      });
      currentDbIndex = notionDatabases.length - 1;
      chrome.storage.local.set({ notionDatabases }, () => {
        renderCurrentDb();
      });
    });
  });
  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["notionDatabases"], () => {
      alert("All data was deleted");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      currentDbIndex = 0;
      renderCurrentDb();
    });
  });

  // ========== 單一資料庫抓取 Notion 與更新 Page Title、統計 ==========
  async function fetchSingleNotion(dbId, startTime) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["notionDatabases", "splitChar", "notionToken"], async (res) => {
        let notionDatabases = res.notionDatabases || [];
        const splitChar = res.splitChar || "/";
        const notionToken = res.notionToken || "";
        const targetDb = notionDatabases.find(x => x.id === dbId);
        if (!targetDb) return resolve(false);
        const pageId = targetDb.pageId.trim();
        if (!pageId || !notionToken) {
          return resolve(false);
        }
        try {
          const pageTitle = await fetchPageTitle(pageId, notionToken);
          targetDb.pageTitle = pageTitle;
          const allBlocks = await fetchAllBlocks(pageId, notionToken);
          const { notionJson, problemBlockList } = convertBlocksToJson(allBlocks, splitChar);
          targetDb.jsonData = substitutePlaceholders(notionJson);
          const endTime = performance.now();
          const runSec = (endTime - startTime) / 1000;
          targetDb.latestStats = {
            dataStatus: "Finish",
            blockCount: Object.keys(notionJson).length,
            problemCount: problemBlockList.length,
            problemBlockList,
            runTime: runSec
          };
          chrome.storage.local.set({ notionDatabases }, () => {
            resolve(true);
          });
        } catch (error) {
          console.error(error);
          if (targetDb) {
            targetDb.latestStats = {
              dataStatus: "Fail",
              blockCount: 0,
              problemCount: 0,
              problemBlockList: [],
              runTime: 0
            };
            chrome.storage.local.set({ notionDatabases }, () => {
              resolve(false);
            });
          } else {
            resolve(false);
          }
        }
      });
    });
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
      if (data.results) {
        allBlocks = allBlocks.concat(data.results);
      }
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }
    return allBlocks;
  }

  async function fetchPageTitle(pageId, notionToken) {
    try {
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28"
        }
      });
      const data = await response.json();
      if (data.object === "page" && data.properties) {
        for (const propName in data.properties) {
          const prop = data.properties[propName];
          if (prop && prop.type === "title" && Array.isArray(prop.title) && prop.title.length) {
            return prop.title[0].plain_text || "Untitled Page";
          }
        }
        return "Untitled Page";
      }
      return "Unknown Page";
    } catch (error) {
      console.error("fetchPageTitle Error:", error);
      return "Error Fetching Title";
    }
  }

  function convertBlocksToJson(blocks, splitChar) {
    const notionJson = {};
    const problemBlockList = [];
    blocks.forEach(block => {
      if (
        block.type === "paragraph" &&
        block.paragraph &&
        block.paragraph.rich_text &&
        block.paragraph.rich_text.length > 0
      ) {
        const textContent = block.paragraph.rich_text.map(t => t.plain_text).join("");
        const parts = textContent.split(splitChar);
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const merged = parts.slice(1).join(splitChar);
          const description = merged.trim();
          if (!notionJson[key]) {
            notionJson[key] = { description };
          } else {
            notionJson[key].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${description}`;
          }
        } else {
          problemBlockList.push(textContent.trim() || "(Empty)");
        }
      }
    });
    return { notionJson, problemBlockList };
  }

  function substitutePlaceholders(originalJsonData) {
    const jsonData = JSON.parse(JSON.stringify(originalJsonData));
    Object.keys(jsonData).forEach(mainKey => {
      const obj = jsonData[mainKey];
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(prop => {
          let text = obj[prop];
          if (typeof text === "string") {
            text = text.replace(/\&\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description.replace(/\&\{[^}]+\}/g, "").replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_GREEN__【※】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            text = text.replace(/\~\{([^}]+)\}/g, (match, refKey) => {
              if (originalJsonData.hasOwnProperty(refKey)) {
                const refObj = originalJsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description.replace(/\&\{[^}]+\}/g, "").replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_RED__【！】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            text = text.replace(/\@\{([^}]+)\}/g, (match, content) => {
              return `__PLACEHOLDER_BLUE__【e.g.】: ${content}__ENDPLACEHOLDER__`;
            });
            obj[prop] = text;
          }
        });
      }
    });
    return jsonData;
  }
  function sendHighlightMessageForAll() {
    chrome.storage.local.get(["notionDatabases", "highlightColor"], (res) => {
      const notionDatabases = res.notionDatabases || [];
      const color = res.highlightColor || highlightColorInput.value || "#ffff33";
      const finalCombined = {};
      // 跨資料庫重複 key 用分隔線合併，且前面標示來源（以灰色小字顯示）
      notionDatabases.forEach(db => {
        if (db.jsonData && typeof db.jsonData === "object") {
          for (const [key, val] of Object.entries(db.jsonData)) {
            if (!finalCombined[key]) {
              finalCombined[key] = { description: `<span style="color: gray; font-size: 10px;">From: ${db.pageTitle}</span>\n${val.description}` };
            } else {
              finalCombined[key].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"><span style="color: gray; font-size: 10px;">From: ${db.pageTitle}</span>
${val.description}`;
            }
          }
        }
      });
      const keyValues = Object.entries(finalCombined).map(([k, v]) => ({ key: k, value: v }));
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "HIGHLIGHT_BATCH",
            keyValues: keyValues,
            highlightColor: color
          });
        });
      });
    });
  }

  // ========== 「Highlight！」／「Stop」按鈕 ==========
  toggleModeBtn.addEventListener("click", () => {
    if (toggleModeBtn.textContent === "Highlight！") {
      chrome.storage.local.get("notionDatabases", (res) => {
        const notionDatabases = res.notionDatabases || [];
        let hasData = false;
        for (const db of notionDatabases) {
          if (db.jsonData && Object.keys(db.jsonData).length > 0) {
            hasData = true;
            break;
          }
        }
        if (!hasData) {
          alert("No data. Please click Refresh on the current database to load from Notion.");
          return;
        }
        sendHighlightMessageForAll();
        updateModeDisplay("highlighter");
        toggleModeBtn.textContent = "Stop";
        updateBackground(true);
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

  function updateModeDisplay(mode) {
    currentModeP.textContent = "Current Mode：" + (mode === "highlighter" ? "Highlighting" : "Stop");
  }
  function updateBackground(isHighlighting) {
    document.body.style.background = isHighlighting
      ? "linear-gradient(120deg, #4A251B 0%, #7F4339 100%)"
      : "linear-gradient(120deg, rgb(61, 61, 61) 0%, rgb(0, 0, 0) 100%)";
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_FINISHED" && isNeedRecordTime) {
      const fetchDuration = fetchTime - processTime;
      const highlightDuration = Date.now() - fetchTime;
      const totalSec = (fetchDuration + highlightDuration) / 1000;
      console.log("Process Time：", totalSec.toFixed(2) + "s");
      isNeedRecordTime = 0;
    }
    sendResponse();
  });

  // ========== 上一個／下一個按鈕 ==========
  prevDbBtn.addEventListener("click", () => {
    currentDbIndex--;
    renderCurrentDb();
  });
  nextDbBtn.addEventListener("click", () => {
    currentDbIndex++;
    renderCurrentDb();
  });

  // 初始載入：若已有資料則預設顯示最後一筆資料
  chrome.storage.local.get("notionDatabases", (res) => {
    const notionDatabases = res.notionDatabases || [];
    if (notionDatabases.length > 0) {
      currentDbIndex = notionDatabases.length - 1;
    }
    let hasData = false;
    for (const db of notionDatabases) {
      if (db.jsonData && Object.keys(db.jsonData).length > 0) {
        hasData = true;
        break;
      }
    }
    renderCurrentDb();
    if (hasData) {
      toggleModeBtn.textContent = "Stop";
      updateModeDisplay("highlighter");
      updateBackground(true);
    } else {
      toggleModeBtn.textContent = "Highlight！";
      updateModeDisplay("stopped");
      updateBackground(false);
    }
  });
});
