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

/**
 * 在網頁中高亮指定關鍵字，並使用共用 tooltip 顯示 infoData 內容
 */
function highlightText(keyword, infoData, root = document.body) {
  if (!keyword) return;
  const needle = keyword.trim();
  if (!needle) return;
  
  const regex = new RegExp(escapeRegExp(needle), "gi");
  
  walkTextNodes(root, (textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;
    let textContent = textNode.nodeValue;
    let match;
    let fragmentList = [];
    let lastIndex = 0;
    
    while ((match = regex.exec(textContent)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;
      if (matchStart > lastIndex) {
        fragmentList.push(document.createTextNode(textContent.slice(lastIndex, matchStart)));
      }
      const span = document.createElement("span");
      span.className = "highlighted";
      span.textContent = textContent.slice(matchStart, matchEnd);
      // 預設背景設定為螢光黃（可自行調整或保留原效果）
      span.style.backgroundColor = "#ffff33";
      span.setAttribute("data-key", keyword);
      if (infoData) {
        span.addEventListener("mouseover", (e) => {
          const tooltip = getSharedTooltip();
          tooltip.innerHTML = buildTooltipString(keyword, infoData);
          tooltip.style.left = e.pageX + "px";
          tooltip.style.top = (e.pageY + 10) + "px";
          tooltip.style.opacity = "1";
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
            tooltip.innerHTML = buildTooltipString(keyword, infoData);
          }
          // 將背景色改為灰色
          e.currentTarget.style.backgroundColor = "#808080";
          // 通知 popup 讀取 Gist（僅讀取，不更新遠端資料）
          chrome.runtime.sendMessage({ action: "UPDATE_GIST" });
        });
      }
      fragmentList.push(span);
      lastIndex = matchEnd;
    }
    if (lastIndex < textContent.length) {
      fragmentList.push(document.createTextNode(textContent.slice(lastIndex)));
    }
    if (fragmentList.length > 0) {
      fragmentList.forEach((el) => parent.insertBefore(el, textNode));
      parent.removeChild(textNode);
    }
  });
}

function buildTooltipString(keyword, infoData) {
  // 將標題作為首個區塊
  let html = `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.2); margin-bottom:4px;">${keyword}</div>`;
  const props = Object.keys(infoData).reverse();
  for (const prop of props) {
    let line = infoData[prop];
    // 將綠色標記替換為內聯HTML（獨立區塊）
    line = line.replace(/__PLACEHOLDER_GREEN__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.GREEN}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
    // 將紅色標記替換為內聯HTML（獨立區塊）
    line = line.replace(/__PLACEHOLDER_RED__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.RED}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
    // 將藍色標記替換為內聯HTML（獨立區塊）
    line = line.replace(/__PLACEHOLDER_BLUE__(.*?)__ENDPLACEHOLDER__/g,
      `<div style="background-color: ${placeholderColorMap.BLUE}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">$1</div>`);
    // 若該行無特殊標記，則包裝為獨立區塊
    if (!line.includes("__PLACEHOLDER_")) {
      line = `<div style="padding:2px 0;">${line}</div>`;
    }
    html += line;
  }
  return html;
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

function walkTextNodes(node, callback) {
  if (node.nodeType === Node.TEXT_NODE) {
    callback(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (["SCRIPT", "STYLE", "IFRAME", "CANVAS", "SVG"].includes(node.nodeName)) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      walkTextNodes(node.childNodes[i], callback);
    }
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "HIGHLIGHT_BATCH") {
    message.keyValues.forEach(({ key, value }) => {
      highlightText(key, value);
    });
  } else if (message.action === "CLEAR") {
    clearHighlight();
  }
  sendResponse();
});

// 自動更新高亮：當頁面載入或網址變更時，自動從 chrome.storage 讀取 jsonData 更新高亮
function updateHighlightsFromStorage() {
  chrome.storage.local.get("jsonData", (result) => {
    if (result.jsonData) {
      clearHighlight();
      const jsonData = result.jsonData;
      const keyValues = Object.entries(jsonData).map(([key, value]) => ({ key, value }));
      keyValues.forEach(({ key, value }) => {
        highlightText(key, value);
      });
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
