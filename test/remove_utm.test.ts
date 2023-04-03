import remove_utm from "../src/handlers/remove_utm"


test('[utm] test b23.tv test1', async () => {
  let url = 'https://b23.tv/JhtHNcp'
  let result_url = 'https://www.bilibili.com/video/BV1W34y1b7Jb'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})


test('[utm] test b23.tv test2 (mobile dynamic)', async () => {
  let url = 'https://b23.tv/HiikdZA'
  let result_url = 'https://m.bilibili.com/dynamic/778474101217951784'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test b23.tv test3 (cv dynamic)', async () => {
  let url = 'https://b23.tv/jhMyc3m'
  // maybe remove /mobile ?
  let result_url = 'https://www.bilibili.com/read/mobile/18911017'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test y.music.163.com', async () => {
  let url = '分享114的单曲《(Live)》: https://y.music.163.com/m/song?id=1&userid=114514 (来自@网易云音乐)'
  let result_url = '分享114的单曲《(Live)》: https://y.music.163.com/m/song?id=1 (来自@网易云音乐)'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test short link (t.co)', async () => {
  let url = 'https://t.co/B4Gh4qp4Jm'
  let result_url = 'https://cn.yna.co.kr/view/ACK20220414005800881?input=tw'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test short link (tb.cn -> taobao)', async () => {
  let url = 'https://m.tb.cn/h.Uq3TpIN'
  let result_url = 'https://item.taobao.com/item.htm?id=688299817603'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test short link (tb.cn -> goofish)', async () => {
  let url = 'https://m.tb.cn/h.UJHazQL'
  let result_url = 'https://h5.m.goofish.com/item?id=710539963567'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})
test('[utm] test keep pathname friendly 1 (uriencode)', async () => {
  let url = 'https://telegra.ph/长沙居民自建房倒塌事故-参与违规改造两人被刑拘-05-03'
  let result_url = 'https://telegra.ph/长沙居民自建房倒塌事故-参与违规改造两人被刑拘-05-03'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test keep pathname friendly 2 (no pathname)', async () => {
  let url = 'https://huggy.moe'
  let result_url = 'https://huggy.moe'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test keep pathname friendly 3 (pathname only have /)', async () => {
  let url = 'https://huggy.moe/'
  let result_url = 'https://huggy.moe/'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] test keep pathname friendly 4 (pathname with decodeuri)', async () => {
  let url = 'https://huggy.moe/テスト?utm_source=website&utm_medium=referral&utm_campaign=last-generation'
  let result_url = 'https://huggy.moe/テスト'
  let a = await remove_utm(await remove_utm(url), 3)
  expect(a).toBe(result_url)
})

