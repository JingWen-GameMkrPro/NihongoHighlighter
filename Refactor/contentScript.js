const tipColorMap = {
  GREEN: "rgb(0, 69, 0)",
  RED: "rgb(92, 0, 0)",
  BLUE: "rgb(0, 32, 65)",
};

function collectMatchesInNode(text, trieRoot) {
  const matches = [];
  const lowerText = text.toLowerCase();
  for (let i = 0; i < lowerText.length; i++) {
    let node = trieRoot;
    for (let j = i; j < lowerText.length; j++) {
      const currentChar = lowerText[j];
      if (!node.children?.[currentChar]) break;
      node = node.children[currentChar];
      if (node.isEnd) {
        //HACK: WHY IS J + 1? 因為會使用slice
        matches.push({
          start: i,
          end: j + 1,
          key: lowerText.slice(i, j + 1),
          infos: node.infos,
        });
      }
    }
  }
  return matches;
}

function constructTipByInfos(key, infos, trie) {
  let tip = `<div style="padding:4px 0; margin-bottom:4px; font-weight: bold;">${key}</div>`;
  tip += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>`;

  infos.forEach((infosObject, i) => {
    if (i > 0) {
      tip += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>`;
    }
    infosObject.subInfos.forEach((info) => {
      switch (info.type) {
        case "Text":
          tip += `<div style="padding:2px 0;">${info.content}</div>`;
          break;
        case "Reference":
          //不能參考自己
          if (key === info.content) {
            break;
          }
          let refInfos = trie.findNode(info.content).infos;
          if (refInfos !== null) {
            tip += `<div style="background-color: ${tipColorMap.GREEN}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">`;
            refInfos.forEach((refInfosObject) => {
              refInfosObject.subInfos.forEach((info) => {
                switch (info.type) {
                  case "Reference":
                  case "Notice":
                    break;
                  case "Text":
                    tip += `<div style="padding:2px 0;">${info.content}</div>`;
                    break;
                  case "Example":
                    tip += `<div style="background-color: ${tipColorMap.BLUE}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">${info.content}</div>`;
                    break;
                }
              });
            });
            tip += `</div>`;
          }

          break;
        case "Notice":
          //不能參考自己
          if (key === info.content) {
            break;
          }
          let noticeInfos = findTrieNode(trie, info.content).infos;
          if (noticeInfos !== null) {
            tip += `<div style="background-color: ${tipColorMap.RED}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">`;
            noticeInfos.forEach((noticeInfosObject) => {
              noticeInfosObject.subInfos.forEach((info) => {
                switch (info.type) {
                  case "Reference":
                  case "Notice":
                    break;
                  case "Text":
                    tip += `<div style="padding:2px 0;">${info.content}</div>`;
                    break;
                  case "Example":
                    tip += `<div style="background-color: ${tipColorMap.BLUE}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">${info.content}</div>`;
                    break;
                }
              });
            });
            tip += `</div>`;
          }
          break;
        case "Example":
          tip += `<div style="background-color: ${tipColorMap.BLUE}; padding:2px 4px; margin-bottom:2px; border-radius:4px;">${info.content}</div>`;
          break;
        default:
          console.error("This info doesn't have type: " + info);
          break;
      }
    });
  });

  return tip;
}

function highlightMatches(node, matches, trie) {
  //排序匹配，可讓短的在最上層，避免被覆蓋
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const domCopy = document.createDocumentFragment();
  const text = node.nodeValue;
  let cursor = 0;
  for (const { start, end, key, infos } of matches) {
    //填充未被高亮的原始文字
    if (start > cursor) {
      domCopy.appendChild(document.createTextNode(text.slice(cursor, start)));
    }
    //開始處理高亮的部分
    const span = document.createElement("span");
    span.textContent = text.slice(start, end);
    span.className = "highlight";

    span.addEventListener("mouseover", (e) => {
      const toolTip = getSharedTooltip();
      toolTip.innerHTML = constructTipByInfos(key, infos, trie);
      let posX = e.pageX;
      let posY = e.pageY + 10;
      toolTip.style.left = posX + "px";
      toolTip.style.top = posY + "px";
      toolTip.style.opacity = "1";
      setTimeout(adjustTooltipPosition, 0);
    });

    span.addEventListener("mouseout", () => {
      const tooltip = getSharedTooltip();
      tooltip.style.opacity = "0";
    });

    domCopy.appendChild(span);
    cursor = end;
  }
  if (cursor < text.length) {
    domCopy.appendChild(document.createTextNode(text.slice(cursor)));
  }
  node.parentNode.replaceChild(domCopy, node);
}

function adjustTooltipPosition() {
  const tooltip = getSharedTooltip();
  const rect = tooltip.getBoundingClientRect();
  let currentLeft = parseInt(tooltip.style.left, 10) || 0;
  let currentTop = parseInt(tooltip.style.top, 10) || 0;
  const margin = 10;
  if (rect.right > window.innerWidth) {
    currentLeft -= rect.right - window.innerWidth + margin;
  }
  if (rect.left < 0) {
    currentLeft = margin;
  }
  if (rect.bottom > window.innerHeight) {
    currentTop -= rect.bottom - window.innerHeight + margin;
  }
  if (rect.top < 0) {
    currentTop = margin;
  }
  tooltip.style.left = currentLeft + "px";
  tooltip.style.top = currentTop + "px";
}
function getSharedTooltip() {
  if (!window.sharedTooltip) {
    window.sharedTooltip = document.createElement("div");
    window.sharedTooltip.className = "shared-tooltip";
    window.sharedTooltip.style.position = "absolute";
    window.sharedTooltip.style.padding = "8px 12px";
    window.sharedTooltip.style.background =
      "linear-gradient(135deg, #000000, #1a1a1a)";
    window.sharedTooltip.style.color = "#f0f0f0";
    window.sharedTooltip.style.borderRadius = "8px";
    window.sharedTooltip.style.fontSize = "14px";
    window.sharedTooltip.style.fontFamily =
      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    window.sharedTooltip.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    window.sharedTooltip.style.zIndex = 10000;
    window.sharedTooltip.style.pointerEvents = "none";
    window.sharedTooltip.style.whiteSpace = "pre-line";
    window.sharedTooltip.style.transition = "opacity 0.2s ease";
    window.sharedTooltip.style.opacity = "0";
    document.body.appendChild(window.sharedTooltip);
  }
  return window.sharedTooltip;
}
function processHighlight(root, trie) {
  // 分析document，
  // 找出想要的指定內容 e.g. 文字節點
  // 過濾掉空白、換行...字元
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // 1. 空白文字直接踢掉
      if (!/\S/.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      // 2. 如果這個文字節點在 <input>、<textarea> 或任何 contentEditable 裡，就跳過它整個子樹
      let el = node.parentElement;
      while (el) {
        if (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        el = el.parentElement;
      }
      // 3. 其他都接受
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // 收集文字節點
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  // 將每個文字節點進行分析
  for (const textNode of textNodes) {
    const matches = collectMatchesInNode(textNode.nodeValue, trie.root);
    if (matches.length) {
      highlightMatches(textNode, matches, trie);
    }
  }
}

function findTrieNode(trie, key) {
  let node = trie.root;
  for (const char of key) {
    if (!node.children[char]) {
      return null;
    }
    node = node.children[char];
  }
  return node.isEnd ? node : null;
}

function clearHighlight() {
  const highlighted = document.querySelectorAll("span.highlight");
  highlighted.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    const textNode = document.createTextNode(span.textContent);
    parent.replaceChild(textNode, span);
    parent.normalize();
  });
}
// 收到 background 的 HIGHLIGHT 訊息後，立即對整頁做高亮
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "HIGHLIGHT" && msg.trie) {
    try {
      console.log("Process Highlight Task");
      processHighlight(document.body, msg.trie);
    } catch (e) {
      console.error("高亮時發生錯誤：", e);
    }
  }

  if (msg.action === "UNHIGHLIGHT") {
    clearHighlight();
  }
  // 表示我們會異步呼叫 sendResponse（如果需要）
  return true;
});
