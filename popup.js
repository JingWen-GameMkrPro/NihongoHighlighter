let processTime = 0;
let isNeedRecordTime = 0;
let fetchTime = 0;

document.addEventListener("DOMContentLoaded", () => {
  const toggleModeBtn = document.getElementById("toggleModeBtn");
  const deleteStorageBtn = document.getElementById("deleteStorageBtn");
  const currentModeP = document.getElementById("currentMode");
  const highlightColorInput = document.getElementById("highlightColor");
  const splitCharInput = document.getElementById("splitChar");
  const dbContainer = document.getElementById("dbContainer");
  const addDbBtn = document.getElementById("addDbBtn");

  // 初次載入時，嘗試讀 splitChar
  chrome.storage.local.get(["splitChar"], (res) => {
    if (res.splitChar) {
      splitCharInput.value = res.splitChar;
    } else {
      splitCharInput.value = "/";
      chrome.storage.local.set({ splitChar: "/" });
    }
  });

  // 監聽使用者改動 splitChar
  splitCharInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ splitChar: e.target.value });
  });

  // 更新背景
  function updateBackground(isHighlighting) {
    document.body.style.background = isHighlighting
      ? "linear-gradient(120deg, #4A251B 0%, #7F4339 100%)"
      : "linear-gradient(120deg, rgb(61, 61, 61) 0%, rgb(0, 0, 0) 100%)";
  }

  // 更新模式文字
  function updateModeDisplay(mode) {
    currentModeP.textContent = "Current Mode：" + (mode === "highlighter" ? "Highlighting" : "Stop");
  }

  // 用於將多資料庫 jsonData 合併，然後傳送給 contentScript
  function sendHighlightMessageForAll() {
    chrome.storage.local.get(["notionDatabases", "highlightColor"], (res) => {
      const notionDatabases = res.notionDatabases || [];
      const color = res.highlightColor || highlightColorInput.value || "#ffff33";

      const combined = {};
      notionDatabases.forEach(db => {
        if (db.jsonData && typeof db.jsonData === "object") {
          Object.entries(db.jsonData).forEach(([k, v]) => {
            combined[k] = v;
          });
        }
      });

      const keyValues = Object.entries(combined).map(([key, value]) => ({ key, value }));
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // 先清掉舊 highlight
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
          // 再進行新的 highlight
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "HIGHLIGHT_BATCH",
            keyValues: keyValues,
            highlightColor: color
          });
        });
      });
    });
  }

  // 讀取所有資料庫，進行畫面渲染
  function renderAllDbs() {
    chrome.storage.local.get("notionDatabases", (res) => {
      let notionDatabases = res.notionDatabases || [];
      if (!notionDatabases.length) {
        // 預設至少一組
        notionDatabases = [{
          id: Date.now().toString(),
          pageId: "",
          notionToken: "",
          jsonData: {}
        }];
        chrome.storage.local.set({ notionDatabases });
      }

      dbContainer.innerHTML = `
        <h1 style="font-size:16px;">Manage Databases</h1>
      `;
      notionDatabases.forEach((dbItem, index) => {
        const block = document.createElement("div");
        block.className = "block-area";
        block.style.marginTop = "15px";
        block.innerHTML = `
          <h2 style="font-size:15px;">Database #${index + 1}</h2>
          <label>Page ID：</label><br>
          <input type="text" class="pageIdInput" value="${dbItem.pageId}" data-id="${dbItem.id}" />
          <br><label>Token：</label><br>
          <input type="password" class="tokenInput" value="${dbItem.notionToken}" data-id="${dbItem.id}" />
          <br>
          <button class="refreshDbBtn" data-id="${dbItem.id}" style="margin-top:10px;">Refresh</button>
          <button class="deleteDbBtn" data-id="${dbItem.id}" style="margin-left:10px;">Delete</button>
          <p id="status_${dbItem.id}" style="margin-top:8px; font-size:14px; color:#E0DDDA;">尚未更新</p>
        `;
        dbContainer.appendChild(block);
      });
      bindDbEvents();
    });
  }

  // 綁定各 DB 區塊的事件
  function bindDbEvents() {
    document.querySelectorAll(".pageIdInput").forEach(el => {
      el.addEventListener("change", (e) => {
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
    });

    document.querySelectorAll(".tokenInput").forEach(el => {
      el.addEventListener("change", (e) => {
        const changedId = e.target.dataset.id;
        chrome.storage.local.get("notionDatabases", (res) => {
          const notionDatabases = res.notionDatabases || [];
          const findItem = notionDatabases.find(x => x.id === changedId);
          if (findItem) {
            findItem.notionToken = e.target.value.trim();
            chrome.storage.local.set({ notionDatabases });
          }
        });
      });
    });

    document.querySelectorAll(".deleteDbBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const delId = btn.dataset.id;
        chrome.storage.local.get("notionDatabases", (res) => {
          let notionDatabases = res.notionDatabases || [];
          if (notionDatabases.length === 1) {
            alert("無法刪除，至少需保留一組資料庫！");
            return;
          }
          notionDatabases = notionDatabases.filter(x => x.id !== delId);
          chrome.storage.local.set({ notionDatabases }, () => {
            renderAllDbs();
          });
        });
      });
    });

    document.querySelectorAll(".refreshDbBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const dbId = btn.dataset.id;
        document.getElementById(`status_${dbId}`).textContent = "讀取中...";
        // 執行抓取 Notion
        const success = await fetchSingleNotion(dbId);
        document.getElementById(`status_${dbId}`).textContent =
          success ? "完成" : "失敗";

        // 若成功拉到資料，進行 highlight
        if (success) {
          // 標記處理時間
          fetchTime = Date.now();
          if (!isNeedRecordTime) {
            isNeedRecordTime = 1;
            processTime = Date.now();
          }
          sendHighlightMessageForAll();
        }
      });
    });
  }

  // 單一資料庫抓取 Notion
  async function fetchSingleNotion(dbId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["notionDatabases", "splitChar"], async (res) => {
        let notionDatabases = res.notionDatabases || [];
        const splitChar = res.splitChar || "/";
        const targetDb = notionDatabases.find(x => x.id === dbId);
        if (!targetDb) return resolve(false);

        const pageId = targetDb.pageId.trim();
        const notionToken = targetDb.notionToken.trim();
        if (!pageId || !notionToken) {
          return resolve(false);
        }
        try {
          const allBlocks = await fetchAllBlocks(pageId, notionToken);
          const notionJson = convertBlocksToJson(allBlocks, splitChar);
          targetDb.jsonData = substitutePlaceholders(notionJson);
          chrome.storage.local.set({ notionDatabases }, () => {
            resolve(true);
          });
        } catch (error) {
          console.error(error);
          resolve(false);
        }
      });
    });
  }

  // 拉 Notion Blocks
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

  // 將 blocks 轉成簡單 key => description
  function convertBlocksToJson(blocks, splitChar) {
    const notionJson = {};
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
            // 重覆的 key 就把描述合併
            notionJson[key].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>` + description;
          }
        }
      }
    });
    return notionJson;
  }

  // 取代 &{key} / ~{key} / @{xxx} 這些占位符
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
            text = text.replace(/\~\{([^}]+)\}/g, (match, refKey) => {
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

  // ===== 監聽 Highlight Color 變更 =====
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

  // ===== 切換「Highlight / Stop」=====
  toggleModeBtn.addEventListener("click", () => {
    if (toggleModeBtn.textContent === "Highlight！") {
      // 檢查是否有資料
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
          alert("No data. Please click Refresh on any DB block to load from Notion.");
          return;
        }
        sendHighlightMessageForAll();
        updateModeDisplay("highlighter");
        toggleModeBtn.textContent = "Stop";
        updateBackground(true);
      });
    } else {
      // STOP
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      toggleModeBtn.textContent = "Highlight！";
      updateBackground(false);
    }
  });

  // ===== 刪除全部資料 (清空) =====
  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["notionDatabases"], () => {
      alert("All data was deleted");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
      });
      updateModeDisplay("stopped");
      renderAllDbs();
    });
  });

  // ===== 新增一組 DB =====
  addDbBtn.addEventListener("click", () => {
    chrome.storage.local.get("notionDatabases", (res) => {
      let notionDatabases = res.notionDatabases || [];
      notionDatabases.push({
        id: Date.now().toString(),
        pageId: "",
        notionToken: "",
        jsonData: {}
      });
      chrome.storage.local.set({ notionDatabases }, () => {
        renderAllDbs();
      });
    });
  });

  // ===== 監聽來自 contentScript 的完成訊息，用於計時 =====
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

  // ===== 初始化 =====
  renderAllDbs();
  // 檢查是否已經有資料
  chrome.storage.local.get("notionDatabases", (res) => {
    const notionDatabases = res.notionDatabases || [];
    let hasData = false;
    for (const db of notionDatabases) {
      if (db.jsonData && Object.keys(db.jsonData).length > 0) {
        hasData = true;
        break;
      }
    }
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
