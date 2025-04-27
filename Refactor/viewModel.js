class viewModel {
  constructor(model) {
    this._model = model;
    this._subscribers = {};
    this._datas = {};
    // //Chrome Storage Local Datas
    // this._datas.push({ isSaveToken: false });
    // this._datas.push({ token: "" });

    //我想關注...資料，資料一變化就執行...
    this._init();
  }
  _init() {
    this._model.subscribe(model.DataType.TOKEN, (newValue) => {
      //this._datas[model.DataType.TOKEN] = newValue; //有必要存在?
      this._notify(model.DataType.TOKEN, newValue);
    });

    this._model.subscribe(model.DataType.SPLIT_CHAR, (newValue) => {
      this._notify(model.DataType.SPLIT_CHAR, newValue);
    });

    this._model.subscribe(model.DataType.HIGHLIGHT_COLOR, (newValue) => {
      this._notify(model.DataType.HIGHLIGHT_COLOR, newValue);
    });

    this._model.subscribe(model.DataType.IS_HIGHLIGHT_MODE, (newValue) => {
      this._notify(model.DataType.IS_HIGHLIGHT_MODE, newValue);
    });
  }

  setData(dataType, value) {
    this._model.setData(dataType, value);
  }

  getData(dataType, callback) {
    this._model.getData(dataType, callback);
  }

  removeData(dataType) {
    chrome.storage.local.remove(dataType);
  }

  subscribe(dataType, callback) {
    if (!this._subscribers[dataType]) {
      this._subscribers[dataType] = [];
    }
    if (!this._subscribers[dataType].includes(callback)) {
      this._subscribers[dataType].push(callback);
    }
  }

  unsubscribe(dataType, callback) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType] = this._subscribers[dataType].filter(
        (cb) => cb !== callback
      );
    }
  }

  _notify(dataType, data) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType].forEach((callback) => {
        callback(data);
      });
    }
  }

  exchangeMode() {
    this._model.getData(model.DataType.IS_HIGHLIGHT_MODE, (value) => {
      if (value === true) {
        this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, false);
      } else {
        this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, true);
      }
    });
  }
}
const viewModelInstance = new viewModel(modelInstance);
