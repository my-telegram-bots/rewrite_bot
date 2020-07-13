const token = ''
const bot_username = '@rewrite_bot'
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
async function handleRequest(request) {
    if(request.method == 'POST'){
        let data = await request.json()
        if(data.message !== undefined){
            domessage(data.message)
        }else if(data.inline_query !== undefined){
            doinline(data.inline_query)
        }
    }
    return new Response('ok', {status: 200})
}
async function domessage(d){
    let chat_id = d.chat.id
    let text = d.text || ''
    let otext = text.split(' ')
    if(text[0] == '/'){
        otext[0] = otext[0].replace('/','').replace(bot_username,'')
        switch (otext[0]) {
            case 'start':
                await tg(token,'sendmessage',{
                    chat_id: chat_id,
                    text: '目前本机器人有空格功能，您可以点击下面的按钮来尝试。',
                    reply_markup: '{"inline_keyboard":[[{"text":"尝试一下","switch_inline_query":""}]]}' // 这只是懒得JSON stringify了
                })
                break
        }
    }
}
async function doinline(d){
    let inline_query_id = d.id
    let query = d.query
    let res_data = []
    if(query != ''){
        res_data.push({
            id: 'add_space',
            title: query.split('').join(' '),
            type: 'article',
            input_message_content: {
                message_text: query.split('').join(' ')
            }
        })
    }else{
        res_data.push({
            id: 'empty',
            title: "输入点什么吧",
            type: 'article',
            input_message_content: {
                message_text: 'undefined'
            }
        })
    }

    await tg(token,'answerInlineQuery',{
        inline_query_id: inline_query_id,
        cache_time: 86400,
        results: JSON.stringify(res_data),
    })
}

async function tg(token,type,data,n = true){
    try {
        let t = await fetch('https://api.telegram.org/bot' + token + '/' + type,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
        })
        let d = await t.json()
        if(!d.ok && n)
            throw d
        else
            return d
    }catch(e){
        await tg(token,'sendmessage',{
            chat_id: master_id,
            text: 'Request tg error\n\n' /**+ JSON.stringify(data) + '\n\n' */ + JSON.stringify(e)
        },false)
        return e
    }
} 