import remove_utm from "../src/handlers/remove_utm"

test('[utm] b23.tv test1', async () => {
  let url = 'https://b23.tv/JhtHNcp'
  let result_url = 'https://www.bilibili.com/video/BV1W34y1b7Jb'
  let a = await remove_utm(url)
  expect(a).toBe(result_url)
})