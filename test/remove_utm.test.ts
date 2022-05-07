import remove_utm from "../src/handlers/remove_utm"


test('[utm] test b23.tv test1', async () => {
  let url = 'https://b23.tv/JhtHNcp'
  let result_url = 'https://www.bilibili.com/video/BV1W34y1b7Jb'
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
