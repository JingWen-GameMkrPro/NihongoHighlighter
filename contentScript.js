// contentScript.js

// 建立全域共用的 tooltip，如果尚未建立的話
function getSharedTooltip() {
  if (!window.sharedTooltip) {
    window.sharedTooltip = document.createElement("div");
    window.sharedTooltip.className = "shared-tooltip";
    window.sharedTooltip.style.position = "absolute";
    window.sharedTooltip.style.padding = "4px 8px";
    window.sharedTooltip.style.backgroundColor = "#333";
    window.sharedTooltip.style.color = "#fff";
    window.sharedTooltip.style.borderRadius = "4px";
    window.sharedTooltip.style.fontSize = "12px";
    window.sharedTooltip.style.zIndex = 10000;
    window.sharedTooltip.style.pointerEvents = "none"; // 不阻擋滑鼠事件
    window.sharedTooltip.style.display = "none";
    window.sharedTooltip.style.whiteSpace = "pre-line";
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
      // 預設背景設定為螢光黃
      span.style.backgroundColor = "#ffff33";
      span.setAttribute("data-key", keyword);
      if (infoData) {
        span.addEventListener("mouseover", (e) => {
          const tooltip = getSharedTooltip();
          tooltip.textContent = buildTooltipString(keyword, infoData);
          tooltip.style.left = e.pageX + "px";
          tooltip.style.top = e.pageY + 10 + "px";
          tooltip.style.display = "block";
        });
        span.addEventListener("mouseout", () => {
          const tooltip = getSharedTooltip();
          tooltip.style.display = "none";
        });
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          const audio = new Audio(chrome.runtime.getURL("sound.mp3"));
          audio.play();
          let currentCount = parseInt(infoData["count"], 10);
          if (isNaN(currentCount)) currentCount = 0;
          currentCount++;
          infoData["count"] = currentCount.toString();
          const tooltip = getSharedTooltip();
          if (tooltip.style.display !== "none") {
            tooltip.textContent = buildTooltipString(keyword, infoData);
          }
          // 將背景色改為灰色（#808080）
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
  const lines = [];
  lines.push(`${keyword}`);
  for (const prop in infoData) {
    if (Object.hasOwn(infoData, prop)) {
      lines.push(`${prop}: ${infoData[prop]}`);
    }
  }
  return lines.join("\n");
}

/**
 * 清除所有高亮：先替換高亮 span 為純文字節點，然後合併相鄰文字節點
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
  // 呼叫回應以避免「message port closed」錯誤
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
