// contentScript.js

// 自訂佔位符顏色設定，你可以在此調整RGB色彩
const placeholderColorMap = {
  GREEN: "rgb(0, 69, 0)",      // 例如：亮綠色
  RED:   "rgb(92, 0, 0)",      // 例如：淡紅色
  BLUE:  "rgb(0, 32, 65)"      // 例如：淡藍色
};

// 建立全域共用的 tooltip，如果尚未建立的話
function getSharedTooltip() {
  if (!window.sharedTooltip) {
    window.sharedTooltip = document.createElement("div");
    window.sharedTooltip.className = "shared-tooltip";
    // 設定 tooltip 的樣式：黑色調、漸層、現代化字型與陰影
    window.sharedTooltip.style.position = "absolute";
    window.sharedTooltip.style.padding = "8px 12px";
    window.sharedTooltip.style.background = "linear-gradient(135deg, #000000, #1a1a1a)";
    window.sharedTooltip.style.color = "#f0f0f0";
    window.sharedTooltip.style.borderRadius = "8px";
    window.sharedTooltip.style.fontSize = "14px";
    window.sharedTooltip.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    window.sharedTooltip.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    window.sharedTooltip.style.zIndex = 10000;
    window.sharedTooltip.style.pointerEvents = "none"; // 不阻擋滑鼠事件
    window.sharedTooltip.style.whiteSpace = "pre-line";
    window.sharedTooltip.style.transition = "opacity 0.2s ease";
    window.sharedTooltip.style.opacity = "0"; // 初始隱藏
    document.body.appendChild(window.sharedTooltip);
  }
  return window.sharedTooltip;
}

// 新增輔助函數，用於處理文字中內建的佔位符轉換
function processLine(line) {
  line = line.replace(/__PLACEHOLDER_GREEN__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.GREEN}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
  line = line.replace(/__PLACEHOLDER_RED__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.RED}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
  line = line.replace(/__PLACEHOLDER_BLUE__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.BLUE}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
  // 若該行無特殊標記，則包裝為獨立區塊
  if (!line.includes("__PLACEHOLDER_")) {
      line = `<div style="padding:2px 0;">${line}</div>`;
  }
  return line;
}

/**
 * 重新設計提示文字內容：
 * - 第一行顯示 key（不含橫線）
 * - 接著顯示 sub-name
 * - 在 sub-name 與 description 之間插入一條橫線
 * - 最後顯示 description
 */
function buildTooltipString(keyword, infoData) {
  let html = `<div style="padding:4px 0; margin-bottom:4px; font-weight: bold;">${keyword}</div>`;
  if (infoData["sub-name"]) {
    html += processLine(infoData["sub-name"]);
  }
  if (infoData["description"]) {
    html += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>`;
    html += processLine(infoData["description"]);
  }
  return html;
}

// 新增：動態調整 tooltip 位置，確保完整顯示不會超出螢幕邊界
function adjustTooltipPosition() {
  const tooltip = getSharedTooltip();
  const rect = tooltip.getBoundingClientRect();
  let currentLeft = parseInt(tooltip.style.left, 10) || 0;
  let currentTop = parseInt(tooltip.style.top, 10) || 0;
  const margin = 10; // 與邊界的最小間距

  // 調整右邊界
  if (rect.right > window.innerWidth) {
    currentLeft -= (rect.right - window.innerWidth) + margin;
  }
  // 調整左邊界
  if (rect.left < 0) {
    currentLeft = margin;
  }
  // 調整底部邊界
  if (rect.bottom > window.innerHeight) {
    currentTop -= (rect.bottom - window.innerHeight) + margin;
  }
  // 調整頂部邊界
  if (rect.top < 0) {
    currentTop = margin;
  }
  tooltip.style.left = currentLeft + "px";
  tooltip.style.top = currentTop + "px";
}

/**
 * 清除所有高亮：將高亮 span 還原為純文字節點，並合併相鄰文字節點
 */
function clearHighlight() {
  const highlighted = document.querySelectorAll("span.highlighted");
  highlighted.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    const textNode = document.createTextNode(span.textContent);
    parent.replaceChild(textNode, span);
    parent.normalize();
  });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 使用 TreeWalker 一次性遍歷所有文字節點，
 * 先收集符合關鍵字的文字節點，再依照合併正則表達式進行高亮。
 * keyValues 為 { key, value } 陣列，功能保持與原版一致。
 *
 * 新增參數 highlightColor 用來設定高亮顏色（預設為螢光黃）
 */
function highlightAll(keyValues, root = document.body, highlightColor = "#ffff33") {
  if (!keyValues || keyValues.length === 0) return;

  // 建立關鍵字對照表與關鍵字陣列
  const mapping = {};
  const keys = [];
  keyValues.forEach(({ key, value }) => {
    const lowerKey = key.toLowerCase();
    mapping[lowerKey] = { key, infoData: value };
    keys.push(key);
  });
  // 為避免子字串匹配問題，較長的關鍵字先處理
  keys.sort((a, b) => b.length - a.length);
  const pattern = keys.map(escapeRegExp).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");

  // 使用 TreeWalker 遍歷文字節點，但先將符合的節點收集起來，避免在遍歷中修改 DOM
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (node.parentNode && ["SCRIPT", "STYLE", "IFRAME", "CANVAS", "SVG"].includes(node.parentNode.nodeName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const matchingNodes = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeValue && currentNode.nodeValue.search(regex) !== -1) {
      matchingNodes.push(currentNode);
    }
  }

  // 針對每個符合的文字節點進行高亮替換
  matchingNodes.forEach(node => {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    regex.lastIndex = 0; // 重置 regex 指標
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;
      if (matchStart > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, matchStart)));
      }
      const span = document.createElement("span");
      span.className = "highlighted";
      const matchedText = text.slice(matchStart, matchEnd);
      span.textContent = matchedText;
      // 使用動態傳入的高亮顏色（預設為螢光黃）
      span.style.backgroundColor = highlightColor;
      const lookup = mapping[matchedText.toLowerCase()];
      if (lookup) {
        span.setAttribute("data-key", lookup.key);
        span.addEventListener("mouseover", (e) => {
          const tooltip = getSharedTooltip();
          tooltip.innerHTML = buildTooltipString(lookup.key, lookup.infoData);
          let posX = e.pageX;
          let posY = e.pageY + 10;
          tooltip.style.left = posX + "px";
          tooltip.style.top = posY + "px";
          tooltip.style.opacity = "1";
          // 延遲調整位置，確保 tooltip 尺寸已更新
          setTimeout(adjustTooltipPosition, 0);
        });
        span.addEventListener("mouseout", () => {
          const tooltip = getSharedTooltip();
          tooltip.style.opacity = "0";
        });
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          const audio = new Audio(chrome.runtime.getURL("sound.mp3"));
          audio.play();
          const tooltip = getSharedTooltip();
          if (tooltip.style.opacity !== "0") {
            tooltip.innerHTML = buildTooltipString(lookup.key, lookup.infoData);
          }
          // 將背景色改為灰色
          e.currentTarget.style.backgroundColor = "#808080";
          // 通知 popup 讀取 Gist（僅讀取，不更新遠端資料）
          chrome.runtime.sendMessage({ action: "UPDATE_GIST" });
        });
      }
      frag.appendChild(span);
      lastIndex = matchEnd;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "HIGHLIGHT_BATCH") {
    clearHighlight();
    highlightAll(message.keyValues, document.body, message.highlightColor);
    // 如果傳入 startTime，則計算高亮處理完成的耗時並回傳給 popup
    if (message.startTime) {
      const elapsedTime = Date.now() - message.startTime;
      chrome.runtime.sendMessage({ action: "HIGHLIGHT_FINISHED", elapsedTime: elapsedTime });
    }
  } else if (message.action === "CLEAR") {
    clearHighlight();
  }
  sendResponse();
});

// // 自動更新高亮：當頁面載入或網址變更時，自動從 chrome.storage 讀取 jsonData 更新高亮
// function updateHighlightsFromStorage() {
//   chrome.storage.local.get("jsonData", (result) => {
//     if (result.jsonData) {
//       clearHighlight();
//       const jsonData = result.jsonData;
//       const keyValues = Object.entries(jsonData).map(([key, value]) => ({ key, value }));
//       // 此處可加入預設的高亮顏色或從 storage 讀取（此例直接用預設）
//       highlightAll(keyValues);
//     }
//   });
// }

function updateHighlightsFromStorage() {
  chrome.storage.local.get(["jsonData", "highlightColor"], (result) => {
    // 1. 取得儲存的 JSON
    const jsonData = result.jsonData;
    // 2. 取得儲存的自訂顏色，若取不到，就用預設色
    const savedColor = result.highlightColor || "#ffff33"; 

    if (jsonData) {
      clearHighlight();
      const keyValues = Object.entries(jsonData).map(([key, value]) => ({ key, value }));
      // 3. 傳入自訂顏色
      highlightAll(keyValues, document.body, savedColor);
    }
  });
}


window.addEventListener("load", updateHighlightsFromStorage);
window.addEventListener("popstate", updateHighlightsFromStorage);
window.addEventListener("hashchange", updateHighlightsFromStorage);
(function(history) {
  const pushState = history.pushState;
  history.pushState = function(state) {
    const ret = pushState.apply(history, arguments);
    window.dispatchEvent(new Event("popstate"));
    return ret;
  };
})(window.history);
