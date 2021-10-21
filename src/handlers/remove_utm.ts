import axios from 'axios'
import { REDIRECT_CHECK_API } from '../config'
// utm_* see wiki https://en.wikipedia.org/wiki/UTM_parameters
const utm_params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
// need help
// Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{ "www.bilibili.com": string[]; }'.
const hostname_utm_params_blacklist = JSON.parse(JSON.stringify({
    // www = @
    'www.bilibili.com': ['share_medium', 'share_plat', 'share_session_id', 'share_source', 'share_tag', 'timestamp', 'unique_k'],
    'www.twitter.com': ['t', 's'],
    'mobile.twitter.com': ['t', 's']
}))
const hostname_utm_params_whitelist = JSON.parse(JSON.stringify({
    'item.taobao.com': ['id'],
    'a.m.taobao.com': [],
    'detail.tmall.com': ['id']
}))
const hostname_replace = {

}
const short_url_service_domain = ['g.co', 'aka.ms', 'amazon.to', 't.co', 'u.nu', 'bit.ly', 'tinyurl.com', 't.cn', 'b23.tv']

export async function get_redirect(url = '', retry_time = 0): Promise<string> {
    if (retry_time < 5) {
        try {
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
                }
            }
            return await get_redirect(url, retry_time + 1)
        }
    }
    return url
}
export async function real_remove_utm(url = ''): Promise<string> {
    try {
        const u = new URL(url)
        const uu = u.searchParams

        let hostname: string = u.hostname
        if (hostname.split('.').length === 2) {
            hostname = 'www.' + hostname
        }
        if (hostname_utm_params_whitelist[hostname]) {
            // rm all params
            const wu = new URL(url.replace(u.search, ''))
            const wuu = wu.searchParams
            hostname_utm_params_whitelist[hostname].forEach((p) => {
                if (uu.get(p)) {
                    wuu.set(p, <string>uu.get(p))
                }
            })
            url = wu.href
        } else {
            let rm_params = utm_params
            if (hostname_utm_params_blacklist[hostname]) {
                rm_params = [...rm_params, ...hostname_utm_params_blacklist[hostname]]
            }
            rm_params.forEach((p) => {
                uu.delete(p)
            })
            if (short_url_service_domain.includes(u.hostname)) {
                return await real_remove_utm(await get_redirect(url))
            }
            url = u.href
        }
    } catch (error) {

    }
    return url
}
export default async (text = ''): Promise<string> => {
    let stext = await Promise.all(text.split(' ').map(async (url) => {
        return await real_remove_utm(url)
    }))
    return stext.join(' ')
}