interface PathRules {
  prefix: string
  preserve?: string[]
  remove?: string[]
}

const DOMAIN_RULES: Record<string, PathRules[]> = {
  'bilibili.com': [{ prefix: '/video/', preserve: ['p', 't'] }, { prefix: '/read/' }],
  'www.bilibili.com': [{
    prefix: '/',
    remove: ['share_medium', 'share_plat', 'share_session_id', 'share_source', 'share_tag', 'timestamp', 'unique_k', 'plat_id', 'share_from'],
  }],
  'm.bilibili.com': [{
    prefix: '/',
    remove: ['share_medium', 'share_plat', 'share_session_id', 'share_source', 'share_tag', 'timestamp', 'unique_k', 'plat_id', 'share_from'],
  }, { prefix: '/dynamic/' }],
  'item.taobao.com': [{ prefix: '/', preserve: ['id'] }],
  'a.m.taobao.com': [{ prefix: '/' }],
  'detail.tmall.com': [{ prefix: '/', preserve: ['id'] }],
  'h5.m.goofish.com': [{ prefix: '/item', preserve: ['id'] }],
  'music.163.com': [{ prefix: '/song', preserve: ['id'] }],
  'y.music.163.com': [{ prefix: '/m/song', preserve: ['id'] }],
  'mobile.yangkeduo.com': [{ prefix: '/goods1.html', preserve: ['goods_id'] }],
  'open.spotify.com': [{ prefix: '/', remove: ['si'] }],
  'youtu.be': [{ prefix: '/', remove: ['si', 'feature'] }],
  'www.youtube.com': [{ prefix: '/', remove: ['si', 'feature'] }],
  'twitter.com': [{ prefix: '/', remove: ['t', 's'] }],
  'www.twitter.com': [{ prefix: '/', remove: ['t', 's'] }],
  'm.weibo.cn': [{ prefix: '/status' }],
  'www.zhihu.com': [{ prefix: '/question/' }],
  'tieba.baidu.com': [{ prefix: '/p/' }],
  'jp.mercari.com': [{ prefix: '/item/' }],
  'www.xiaohongshu.com': [{ prefix: '/explore/' }, { prefix: '/discovery/item/' }],
}

function matchingRules(hostname: string, pathname: string): PathRules[] {
  const exact = DOMAIN_RULES[hostname] || []
  const bare = hostname.startsWith('www.') ? DOMAIN_RULES[hostname.slice(4)] || [] : []
  return [...exact, ...bare].filter(({ prefix }) => pathname.startsWith(prefix))
}

export function shouldPreserveParameter(hostname: string, pathname: string, name: string): boolean {
  return matchingRules(hostname, pathname).some(({ preserve }) => preserve?.includes(name))
}

export function shouldRemoveLocally(hostname: string, pathname: string, name: string): boolean {
  if (shouldPreserveParameter(hostname, pathname, name)) return false
  return matchingRules(hostname, pathname).some(({ remove }) => remove?.includes(name))
}
