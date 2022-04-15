import { userSetting } from '.prisma/client'

export function DuserSetting(user_id: number | bigint): userSetting {
    return {
        // @ts-ignore
        user_id: user_id,
        // 这是啥东西来着¿
        // 可能是当用户拿多个字符占位的时候，这边用什么方式（一对多还是平铺）
        // 为什么用中文呢，因为也没人看，大概
        hide_mode: 1,
        // single character
        hide_placeholders: '["█","❔","❓","🍞"]',
        expired_time_offset: 0,
        disabled: ''
    }
}