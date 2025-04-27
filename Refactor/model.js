class model {
  constructor() {
    this._subscribers = {};
  }

  //所有資料
  static DataType = Object.freeze({
    TOKEN: "Token",
    MODE: "Mode",
    SPLIT_CHAR: "SplitChar",
    HIGHLIGHT_COLOR: "HighlightColor",
  });

  setData(dataType, value) {
    chrome.storage.local.set({ [dataType]: value }, () => {
      this._notify(dataType, value);
    });
  }

  getData(dataType, callback) {
    chrome.storage.local.get([dataType], (res) => {
      if (res[dataType]) {
        callback(res[dataType]);
      } else {
        callback(null);
      }
    });
  }

  subscribe(dataType, callback) {
    if (!this._subscribers[dataType]) {
      this._subscribers[dataType] = [];
    }
    if (!this._subscribers[dataType].includes(callback)) {
      this._subscribers[dataType].push(callback);
    }
  }

  _notify(dataType, data) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType].forEach((callback) => {
        callback(data);
      });
    }
  }
}
const modelInstance = new model();
//   asyncGetChormeStorageValue(key, callback) {

//   }

//   setChromeStorageValue(key, value) {
//     chrome.storage.local.set({ [key]: value });
//   }

//   removeChromeStorageValue(key) {
//     chrome.storage.local.remove(key);
//   }
