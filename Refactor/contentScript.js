function collectAllMatches(text, trie) {
  const matches = [];
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    let node = trie;
    for (let j = i; j < lower.length; j++) {
      const ch = lower[j];
      if (!node.children?.[ch]) break;
      node = node.children[ch];
      if (node.isEnd) {
        matches.push({ start: i, end: j + 1, infos: node.infos });
      }
    }
  }
  return matches;
}

function highlightTextNode(node, matches) {
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const frag = document.createDocumentFragment();
  const txt = node.nodeValue;
  let cursor = 0;
  for (const { start, end, infos } of matches) {
    if (start > cursor) {
      frag.appendChild(document.createTextNode(txt.slice(cursor, start)));
    }
    const span = document.createElement("span");
    span.className = "highlight";
    //span.dataset.tooltip = tip; // <- 放到 data-tooltip
    span.textContent = txt.slice(start, end);
    let tip = "";
    for (const i of infos) {
      for (const j of i) {
        tip += j.content + "\n";
      }
      tip += "----------------\n";
    }

    span.addEventListener("mouseover", (e) => {
      const toolTip = getSharedTooltip();
      console.log(infos[0].content);
      toolTip.innerhtml = infos[0].content;
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

    frag.appendChild(span);
    cursor = end;
  }
  if (cursor < txt.length) {
    frag.appendChild(document.createTextNode(txt.slice(cursor)));
  }
  node.parentNode.replaceChild(frag, node);
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
function highlightAll(root, trie) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      /\S/.test(n.nodeValue)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const txtNode of nodes) {
    const matches = collectAllMatches(txtNode.nodeValue, trie);
    if (matches.length) highlightTextNode(txtNode, matches);
  }
}

// 收到 background 的 INIT_TRIE 訊息後，立即對整頁做高亮
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "INIT_TRIE" && msg.trie) {
    try {
      console.log(msg.trie);
      highlightAll(document.body, msg.trie.root);
    } catch (e) {
      console.error("高亮時發生錯誤：", e);
    }
  }
  // 表示我們會異步呼叫 sendResponse（如果需要）
  return true;
});
