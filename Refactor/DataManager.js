class DataManager
{
    constructor()
    {
        if(!DataManager.instance)
        {
            DataManager.instance = this;
            //List<NotionPage>
            this.allNotionPages = []

        }
    }

    pushNotionPageDict(page)
    {
        // const NotionPageDict = {
        // pageId: pageId,
        // allNotes: allNotes
        // };

        this.allNotionPages.push(page)
    }

    //包含fetch + create new page + note + update 
    async clickFetchButton(pageId, notionApiKey)
    {
        //fetch
        const notionPageInfoJson = await this.fetchNotionPageInfo(pageId, notionApiKey)
        const notionPageBlcoksJson = await this.fetchNotionPageBlocks(pageId, notionApiKey)

        //更新或新增資料庫
        if(notionPageInfoJson && notionPageBlcoksJson)
        {
            //createPage
            if(!this.isExistPageId(notionPageInfoJson.id))
            {
                const newPage = new NotionPage(notionPageInfoJson, notionPageBlcoksJson)
                this.pushNotionPageDict(newPage)
            }
            else
            {
                //Todo: 更新既有page
                this.getFirstPageById(notionPageInfoJson.id).updateNotionPage(notionPageInfoJson, notionPageBlcoksJson)
                
            }
        }

    }

    getAllNotes()
    {
        //輸出所有筆記資料
        this.allNotionPages.forEach(page => {
            console.log(page.notionPageId)
            page.allNotes.forEach(note => {
                console.log(note.title)
                note.allNoteLines.forEach(line => {
                    console.log(line)
                })
                console.log("----")
            })
            console.log("\n")
        })
    }

    async fetchNotionPageInfo(pageId, notionApiKey)
    {
        const apiUrl = `https://api.notion.com/v1/pages/${pageId}`;
        
        try 
        {
            const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28', 
            },
            });
        
            if (!response.ok) 
            {
                const error = await response.json();
                console.error('Failed to fetch Notion page:', error);
                return null
            }
        
            return await response.json();
        } 
        catch (error) 
        {
            console.error('Error fetching Notion page:', error);
            return null
        }
    }

    async fetchNotionPageBlocks(pageId, notionApiKey)
    {
        const apiUrl = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
        
        try 
        {
            const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28', 
            },
            });
        
            if (!response.ok) 
            {
                const error = await response.json();
                console.error('Failed to fetch Notion page:', error);
                return null
            }
        
            return await response.json();
        } 
        catch (error) 
        {
            console.error('Error fetching Notion page:', error);
            return null
        }
    }

    isExistPageId(id)
    {
        return this.allNotionPages.some(page => page.notionPageId === id)
    }

    getFirstPageById(id)
    {
        return this.allNotionPages.find(page => page.notionPageId === id)
    }

    //Chrome Storage 操作
}

class NotionPage
{
    constructor(pageInfoJson, pageBlocksJson)
    {
        //Key
        this.notionPageId = pageInfoJson.id
        this.pageInfoJson = pageInfoJson
        this.pageBlocksJson = pageBlocksJson

        // this.notionPageEditTime = "";
        // this.fetchTime = ""
        // this.LastFetchDate = ""
        this.allLegalBlocks = []
        this.allWrongBlocks = []
        this.allNotes = []

        this.initial()
    }

    initial()
    {
        this.pageBlocksJson.results.forEach(block => 
        {
            //先篩選type = paragraph
            if(block.type === "paragraph")
            {
                //再來篩選是否有料
                if(block.paragraph.rich_text.length !== 0)
                {
                    const blockContent = block.paragraph.rich_text[0].plain_text;

                    //再來是否可以分割
                    const divideResult = this.tryDivideBlockBySymbol(blockContent, '/')
                    if(divideResult)
                    {
                        this.allLegalBlocks.push(blockContent)
                        const newNote = new Note(divideResult[0], divideResult[1])
                        this.allNotes.push(newNote)
                    }
                    else
                    {
                        this.allWrongBlocks.push(blockContent)
                    }
                }
            }
        });
    }

    updateNotionPage(pageInfoJson, pageBlocksJson)
    {
        this.notionPageId = pageInfoJson.id
        this.pageInfoJson = pageInfoJson
        this.pageBlocksJson = pageBlocksJson

        this.allLegalBlocks = []
        this.allWrongBlocks = []
        this.allNotes = []

        this.initial()
    }

    tryDivideBlockBySymbol(str, symbol)
    {
        const index = str.indexOf(symbol);
        if(index !== -1)
        {
            const part1 = str.substring(0, index); // 沒有宣告 part1
            const part2 = str.substring(index+1);     // 沒有宣告 part2
            return [part1, part2];
        }
        else
        {
            //error
            return null
        }
    }


    //給我 new NotePage(json)
    //我先將他分成多個block (篩選錯誤block)
    //將每個block，根據divide symbol 分成title & contnet，丟給 new Note(title, content)
    //Note自己會整理成筆記資訊

}


class Note
{
    constructor(title, content)
    {
        //筆記標題，key
        this.title = title

        //內容
        this.content = content;
       
        //內容轉換成的筆記，由多個NoteLines組成
        this.allNoteLines = []
        this.splitContent(this.content).forEach(subContent => {
            this.allNoteLines.push(this.checkTypeAndCreateNoteLine(subContent))
        });
    }

    splitContent(content)
    {
        const regex = /[^@~&]+|[@~&]\{[^}]*\}/g;
        return content.match(regex);
    }

    checkTypeAndCreateNoteLine(str)
    {
        const regexExample = /^@\{(?<content>.*)\}$/;
        const regexNotice = /^~\{(?<content>.*)\}$/;
        const regexReference = /^&\{(?<content>.*)\}$/;
        let match = ""

        match = str.match(regexExample)
        if(match && match.groups?.content !== undefined)
        {
            return new NoteLine(NoteLine.NoteLineType.EXAMPLE, match.groups.content)
        }

        match = str.match(regexNotice)
        if(match && match.groups?.content !== undefined)
        {
            return new NoteLine(NoteLine.NoteLineType.NOTICE, match.groups.content)
        }

        match = str.match(regexReference)
        if(match && match.groups?.content !== undefined)
        {
            return new NoteLine(NoteLine.NoteLineType.REFERENCE, match.groups.content)
        }

        return new NoteLine(NoteLine.NoteLineType.DESCRIPTION, str)
    }
}


class NoteLine 
{
    static NoteLineType =  
    Object.freeze
    (
        {
            NONE: 'None',
            DESCRIPTION: 'Description',
            //可參考其他Note，為綠色區塊
            REFERENCE: 'Refernce',
            //紅色醒目區塊
            NOTICE: 'Notice',
            //藍色區塊，可以撰寫例句
            EXAMPLE: 'Example'
        }
    );

    constructor(type, subContent) 
    {
        this.type = type
        this.subContent = subContent
    }
}



  
const pageId = process.argv[3]; // 替換成你的 Notion Page ID
const notionApiKey = process.argv[2]; // 替換成你的 Notion API 金鑰
const dataManagerInstance = new DataManager();

await dataManagerInstance.clickFetchButton(pageId, notionApiKey);
await dataManagerInstance.clickFetchButton('1c8b9e0d4f118022a76ef82fdf679d27', notionApiKey);

dataManagerInstance.getAllNotes()