import remove_utm from "../src/handlers/remove_utm"

test('[utm] b23.tv test1', async () => {
  let url = 'https://b23.tv/JhtHNcp'
  let result_url = 'https://www.bilibili.com/video/BV1W34y1b7Jb'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})

test('[utm] y.music.163.com', async () => {
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