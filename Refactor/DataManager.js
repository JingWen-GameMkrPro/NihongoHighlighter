class DataManager
{
    constructor()
    {
        if(!DataManager.instance)
        {
            DataManager.instance = this;
            //List<Page>
            this.allPages = []
        }
    }

    //不重複
    addPage(page)
    {
        if(page instanceof Page && !this.isExistPageById(page.notionPageId))
        {
            this.allPages.push(page);
        }
    }

    isExistPageById(id)
    {
        return this.allPages.some(page => page.notionPageId === id);
    }

    getAllPages(isCopy)
    {
        return isCopy === true ? [...this.allPages] : this.allPages;
    }

    getPageById(id, isCopy)
    {
        result = this.allPages.find(page => page.notionPageId === id);
        return isCopy === true ? [...result] : result;
    }

    deletePageById(id)
    {
        this.allPages = this.allPages.filter(page => page.notionPageId !== id);
    }

    deleteAllPages()
    {
        this.allPages = [];
    }

    //Chrome Storage 操作


}

class Page
{
    constructor()
    {
        this.notionPageId = "";
        this.notionPageEditTime = "";
        this.allBlocks = [];

        this.fetchTime = ""
        this.LastFetchDate = ""
    }

    getAllBlocks(isCopy)
    {
        return isCopy === true ? [...this.allBlocks] : this.allBlocks;
    }

    getAllWrongBlocks(isCopy)
    {
        result = this.allBlocks.filter(block => block.isSuccessBlock === false)
        return isCopy === true ? [...result] : result
    }

    getAllSuccessBlocks()
    {
        result = this.allBlocks.filter(block => block.isSuccessBlock === true)
        return isCopy === true ? [...result] : result
    }

}

class Block
{
    static CAN_NOT_FIND_DIVIDE_SYMBOL = "This block doesn't have divide symbol！"

    constructor(content, divideSymbol)
    {
        //原始資料
        this.blockContent = content;
        //透過分隔符號分割成Key + Value
        this.blockKey = ""
        this.blockValue = ""
        this.isSuccessBlock = false
        //問題紀錄
        this.Log = ""


        if(content && typeof content === 'string' && divideSymbol && typeof divideSymbol === 'string')
        {
            //找到第一次出現的地方
            const symbolIndex = content.indexOf(divideSymbol);

            if (symbolIndex !== -1) 
            {
              this.blockKey = content.substring(0, symbolIndex).trim()
              this.blockValue = content.substring(symbolIndex + divideSymbol.length).trim()
              this.isSuccessBlock = true
            }
            else
            {
                this.Log = CAN_NOT_FIND_DIVIDE_SYMBOL
            }
        }
    }

}

class Note
{
    constructor()
    {
        this.AllNoteLines = []
    }

    //可能有多筆資料，根據noteTitle
    searchReferenceNote(allNotes, noteTitle)
    {
        //假設找到一個符合的Note，則必須要請他回傳不包含RefernceNoteLine的版本
        //Note.returnAllNoteLinesWithoutRefernce()

        //如果有多個則整理成數組回傳
    }

    returnAllNoteLinesWithoutRefernce()
    {
        result = this.AllNoteLines.filter(noteLine => noteLine.Type !== NoteLineType.REFERENCE)
        return [...result]
    }
}

class NoteLine {
    constructor() 
    {
      this.Type = NoteLineType.NONE
      this.Value = ""
    }



}

const NoteLineType =  
Object.freeze
(
    {
        NONE: 'None',
        TITLE: 'title',
        DESCRIPTION: 'Description',
        REFERENCE: 'Refernce',
        EXAMPLE: 'Example'
    }
);