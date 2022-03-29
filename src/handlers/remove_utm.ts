import axios from 'axios'
import { REDIRECT_CHECK_API } from '../config'
import { domainPathParamsList, domainPathUrlReplaceList } from '../schema'
// utm_* see wiki https://en.wikipedia.org/wiki/UTM_parameters
const utm_params = {
    '/': ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid']
}
// maybe need wildcard support (match */xxx/)
const hostname_utm_params_blacklist: domainPathParamsList = {
    // www = @
    ['www.bilibili.com']: {
        '/': ['share_medium', 'share_plat', 'share_session_id', 'share_source', 'share_tag', 'timestamp', 'unique_k']
    },
    'www.twitter.com': {
        '/': ['t', 's']
    }
}
const hostname_utm_params_whitelist: domainPathParamsList = {
    'www.bilibili.com': {
        //               t=time
        '/video/': ['p', 't']
    },
    'item.taobao.com': {
        '/': ['id']
    },
    // :id.html
    'a.m.taobao.com': {
        '/': []
    },
    'detail.tmall.com': {
        '/': ['id']
    }
}
const hostname_map = {
    'mobile.twitter.com': 'www.twitter.com',
}
// 感觉很侵入性，后面有机会再来优化了 ~~出锅以后再说~~
const hostname_url_replace: domainPathUrlReplaceList = {
    'www.bilibili.com': {
        '/video/': [['?p=1', '']],
    }
}
const short_url_service_domain = ['g.co', 'aka.ms', 'amazon.to', 't.co', 'u.nu', 'bit.ly', 'tinyurl.com', 'b23.tv']

export async function get_redirect(url = '', retry_time = 0): Promise<string> {
    if (retry_time < 5) {
        try {
            // detect new url with proxy
            // prevent attack & trace (IP owner is cloudflare)
            if (REDIRECT_CHECK_API) {
                let s = <string>(await axios.get(REDIRECT_CHECK_API + url, {
                    timeout: 2000
                })).data
                return s
            } else {
                let data = await axios({
                    method: 'GET',
                    url: url,
                    maxRedirects: 0,
                    timeout: 2000,
                    headers: {
                        // maybe need accepted-languages or other fields....
                        // get newest useragent from https://t.me/chrome_useragent
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.40 Safari/537.36'
                    }
                })
                if ((<string>data.data).includes('Checking your browser') && data.headers.server && data.headers.server === 'cloudflare') {
                    // need bypass LOL
                    return url
                }
            }
        } catch (error: any) {
            if (error.response) {
                if ((error.response.status === 301 || error.response.status === 302) && (error.response.headers.Location || error.response.headers.location)) {
                    return error.response.headers.Location || error.response.headers.location
                } else {
                    return url
                }
            } else {
                return await get_redirect(url, retry_time + 1)
            }
        }
    }
    return url
}
export async function real_remove_utm(url = ''): Promise<string> {
    try {
        const u = new URL(url)
        const uu = u.searchParams
        let hostname: string = u.hostname
        if (short_url_service_domain.includes(hostname)) {
            return await real_remove_utm(await get_redirect(url))
        }
        // www = @
        if (hostname.split('.').length === 2) {
            hostname = 'www.' + hostname
        }
        //             bad
        let whitelist: any = []
        if (hostname_utm_params_whitelist[hostname]) {
            for (const key in hostname_utm_params_whitelist[hostname]) {
                if (u.pathname.startsWith(key)) {
                    // whitelist = [...whitelist, hostname_utm_params_whitelist[hostname][key]]
                    whitelist = hostname_utm_params_whitelist[hostname][key]
                    // match to end
                    // break
                }
            }
        }
        if (whitelist.length > 0) {
            // rm all params
            const wu = new URL(url.replace(u.search, ''))
            whitelist.forEach((p: string) => {
                if (uu.get(p)) {
                    wu.searchParams.set(p, <string>uu.get(p))
                }
            })
            url = wu.href
        } else {
            let blacklist: any[] = utm_params['/']
            if (hostname_utm_params_blacklist[hostname]) {
                let temp_blacklist: any = []
                for (const key in hostname_utm_params_blacklist[hostname]) {
                    if (u.pathname.startsWith(key)) {
                        // blacklist = [...blacklist, hostname_utm_params_blacklist[hostname][key]]
                        temp_blacklist = hostname_utm_params_blacklist[hostname][key]
                        // match to end
                        // break
                    }
                }
                if (temp_blacklist.length > 0) {
                    blacklist = [...temp_blacklist, ...blacklist]
                }
            }
            blacklist.forEach((p) => {
                uu.delete(p)
            })
            url = u.href
        }
        let url_replace_list: Array<[string, string]> = []
        for (const key in hostname_url_replace[hostname]) {
            if (u.pathname.startsWith(key)) {
                url_replace_list = hostname_url_replace[hostname][key]
                // break
            }
        }
        url_replace_list.forEach(([u1, u2]) => {
            url = url.replace(u1, u2)
        })
    } catch (error) {
    }
    return url
}
export default async (text = ''): Promise<string> => {
    let stext = await Promise.all(text.split('\n').map(async (l) => {
        return (await Promise.all(l.split(' ').map(async (l) => {
            return (await real_remove_utm(l))
        }))).join(' ')
    }))
    return stext.join('\n')
}