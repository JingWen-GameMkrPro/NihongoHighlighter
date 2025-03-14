// popup.js

// 現在可以存取環境變數

document.addEventListener("DOMContentLoaded", () => {
  // DOM元素的取得
  const startModeBtn = document.getElementById("startModeBtn"),
        stopModeBtn = document.getElementById("stopModeBtn"),
        deleteStorageBtn = document.getElementById("deleteStorageBtn"),
        currentModeP = document.getElementById("currentMode"),
        currentDataSourceP = document.getElementById("currentDataSource"),
        gistInputArea = document.getElementById("gistInputArea"),
        gistUrlInput = document.getElementById("gistUrl"),
        updateGistBtn = document.getElementById("updateGistBtn"),
        keyCountElement = document.getElementById("keyCount"),
        refreshBtn = document.getElementById("refreshBtn"),
        elapsedTimeElement = document.getElementById("elapsedTime"),
        highlightColorInput = document.getElementById("highlightColor");

  // 新增 - 驗證區塊相關
  const verifyBtn = document.getElementById("verifyBtn"),
        localHostInput = document.getElementById("localhostInput"),
        keyInput = document.getElementById("keyInput"),
        verifyResult = document.getElementById("verifyResult");

  // 從 chrome.storage 讀取預設的高亮色彩，若沒有則設定預設為 "#ffff33"
  chrome.storage.local.get("highlightColor", (result) => {
    const defaultColor = "#ffff33";
    if (result.highlightColor) {
      highlightColorInput.value = result.highlightColor;
    } else {
      highlightColorInput.value = defaultColor;
      chrome.storage.local.set({ highlightColor: defaultColor });
    }
  });

  // 當使用者更換顏色時，更新 chrome.storage 的設定
  highlightColorInput.addEventListener("change", (event) => {
    chrome.storage.local.set({ highlightColor: event.target.value });
  });

  // 資料來源固定為Gist
  const defaultGistUrl = "https://gist.github.com/JingWen-GameMkrPro/59306ed6b3f7e9a2847712b45e554390";
  gistUrlInput.value = defaultGistUrl;
  chrome.storage.local.set({ dataSource: "gist" });
  updateDataSourceDisplay("gist");

  // 現在狀態顯示更新
  function updateModeDisplay(mode) {
    currentModeP.textContent = "現在の状態：" + (mode === "highlighter" ? "ハイライト中" : "停止中");
  }

  // 資料來源顯示更新（固定為Gist）
  function updateDataSourceDisplay(mode) {
    gistInputArea.style.display = "block";
    currentDataSourceP.textContent = "データソース：Gist";
  }

  // 更新JSON鍵數顯示
  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? "JSONキー数：" + keys.length : "0";
    });
  }

  // JSON內的佔位符及換行處理（新格式支援）
  function substitutePlaceholders(jsonData) {
    Object.keys(jsonData).forEach(mainKey => {
      const obj = jsonData[mainKey];
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(prop => {
          let text = obj[prop];
          if (typeof text === "string") {
            // 新增：&{...} 格式（背景：綠色）
            text = text.replace(/&\{([^}]+)\}/g, (match, refKey) => {
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description
                  .replace(/\$\{[^}]+\}/g, "")
                  .replace(/\&\{[^}]+\}/g, "")
                  .replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_GREEN__【参】：　${refKey}: ${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            // 新增：~\{...} 格式（背景：紅色）
            text = text.replace(/~\{([^}]+)\}/g, (match, refKey) => {
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (refObj && refObj.description) {
                  const cleanDesc = refObj.description
                  .replace(/\$\{[^}]+\}/g, "")
                  .replace(/\&\{[^}]+\}/g, "")
                  .replace(/\~\{[^}]+\}/g, "");
                  return `__PLACEHOLDER_RED__【似】：　${refKey}: ${cleanDesc}__ENDPLACEHOLDER__`;
                }
              }
              return refKey;
            });
            // 新增：@\{...} 格式（背景：藍色），直接顯示括弧內內容
            text = text.replace(/@\{([^}]+)\}/g, (match, content) => {
              return `__PLACEHOLDER_BLUE__【例】：　${content}__ENDPLACEHOLDER__`;
            });
            // 換行處理
            text = text.replace(/\\n/g, "\n");
            obj[prop] = text;
          }
        });
      }
    });
    return jsonData;
  }

  // 從Gist取得最新JSON（僅在按下按鈕時更新）
  async function fetchGistJson() {
    const gistUrl = gistUrlInput.value.trim();
    if (!gistUrl) {
      alert("GistのURLを入力してください！");
      return null;
    }
    const parts = gistUrl.split("/"),
          gistId = parts[4];
    if (!gistId) {
      alert("GistのURLからIDを取得できません");
      return null;
    }
    const apiUrl = `https://api.github.com/gists/${gistId}?t=${Date.now()}`;
    try {
      const response = await fetch(apiUrl, {
        cache: "no-store",
        headers: {
          "Authorization": "token " + window.config.apiKey
        }
      });
      if (!response.ok) throw new Error("Gistのデータ取得に失敗しました");
      const gistData = await response.json();
      const files = gistData.files,
            fileKeys = Object.keys(files);
      if (!fileKeys.length) throw new Error("このGistにファイルがありません");
      let jsonData = JSON.parse(files[fileKeys[0]].content);
      jsonData = substitutePlaceholders(jsonData);
      return jsonData;
    } catch (error) {
      alert("Gistのデータ取得に失敗しました：" + error.message);
      return null;
    }
  }

  // 從chrome.storage讀取JSON並傳送給contentScript以進行高亮
  function sendHighlightMessage(startTime) {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) {
        const keyValues = Object.entries(result.jsonData).map(([key, value]) => ({ key, value }));
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          // 取得使用者選擇的高亮顏色
          const highlightColor = highlightColorInput.value;
          chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "HIGHLIGHT_BATCH",
              keyValues: keyValues,
              startTime: startTime,
              highlightColor: highlightColor
            });
          });
        });
      }
    });
  }

  // 開始高亮模式（設定JSON到chrome.storage並通知contentScript）
  function startHighlighterMode() {
    updateHighlighter();
    updateModeDisplay("highlighter");
  }

  // 初次更新（僅在按鈕觸發時更新，不使用自動更新）
  async function updateHighlighter() {
    chrome.storage.local.get("dataSource", async (result) => {
      const mode = result.dataSource || "gist";
      if (mode === "gist") {
        const jsonData = await fetchGistJson();
        if (jsonData) {
          // 記錄從成功取得 JSON 開始的時間
          const startTime = Date.now();
          chrome.storage.local.set({ jsonData }, () => {
            sendHighlightMessage(startTime);
            updateKeyCount();
          });
        } else {
          updateKeyCount();
        }
      } else {
        sendHighlightMessage();
        updateKeyCount();
      }
    });
  }

  // 停止高亮模式
  function stopHighlighterMode() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
    });
    updateModeDisplay("stopped");
  }

  // 讀取Gist中的JSON（僅讀取，不更新遠端資料）
  async function updateGistData() {
    const jsonData = await fetchGistJson();
    if (jsonData) {
      chrome.storage.local.set({ jsonData, dataSource: "gist" }, () => {
        updateDataSourceDisplay("gist");
      });
    } else {
      updateKeyCount();
    }
  }

  // 當按下Gist讀取按鈕時，從Gist取得JSON
  updateGistBtn.addEventListener("click", async () => {
    await updateGistData();
  });

  // 開始高亮按鈕事件
  startModeBtn.addEventListener("click", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) startHighlighterMode();
      else alert("JSONデータがありません。先にGistから読み込んでください。");
    });
  });

  // 停止高亮按鈕事件
  stopModeBtn.addEventListener("click", stopHighlighterMode);

  // JSON刪除按鈕事件
  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["jsonData", "dataSource"], () => {
      alert("JSONデータを削除しました");
      stopHighlighterMode();
      updateModeDisplay("stopped");
      currentDataSourceP.textContent = "データソース：なし";
      keyCountElement.textContent = "0";
    });
  });

  // 初始設定：強制將資料來源設為Gist
  chrome.storage.local.set({ dataSource: "gist" }, () => {
    updateModeDisplay("highlighter");
    updateDataSourceDisplay("gist");
    updateKeyCount();
  });

  refreshBtn.addEventListener("click", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) startHighlighterMode();
      else alert("JSONデータがありません。先にGistから読み込んでください。");
    });
    stopHighlighterMode();
  });

  // 監聽 contentScript 回傳的高亮完成訊息，並顯示耗時
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "HIGHLIGHT_FINISHED") {
      elapsedTimeElement.textContent = "経過時間：" + Math.round(message.elapsedTime) + "ms";
    }
  });


  // -------------------------------------------------------
  // 新增「驗證」功能 (Local Host + 金鑰匙)
  // -------------------------------------------------------
  verifyBtn.addEventListener("click", async () => {
    const host = localHostInput.value.trim();
    const keyVal = keyInput.value.trim();

    // 簡單檢查是否有輸入
    if (!host || !keyVal) {
      alert("請輸入 Local Host 及 金鑰匙密碼！");
      return;
    }

    try {
      // 這裡示範用 POST 對指定的 /verify 端點進行驗證
      // 實際可依你的後端需求自行調整
      const response = await fetch(`${host}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyVal })
      });

      if (!response.ok) {
        throw new Error("驗證請求失敗");
      }

      const data = await response.json();
      if (data.result === true) {
        // 若驗證成功，後端會返回 gistUrl、gistToken
        verifyResult.textContent = `驗證成功！gistUrl: ${data.gistUrl}, gistToken: ${data.gistToken}`;
      } else {
        verifyResult.textContent = "驗證失敗";
      }
    } catch (err) {
      console.error(err);
      verifyResult.textContent = "驗證過程發生錯誤";
    }
  });
});
