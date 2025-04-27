class Logger {
  constructor() {
    if (!Logger.instance) {
      Logger.instance = this;
    }
  }

  log(msg) {
    console.log(msg);
  }

  logLocal() {
    chrome.storage.local.get(null, function (items) {
      console.log("Chrome Storage Local 内容:", items);
      // 你可以在这里进一步处理这些数据，例如显示在你的扩展界面上
    });
  }
}
const loggerInstance = new Logger();
