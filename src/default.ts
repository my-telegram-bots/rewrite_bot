import { userSetting } from '.prisma/client'

export function DuserSetting(user_id: number | bigint): userSetting {
    return {
        // @ts-ignore
        user_id: user_id,
        hide_mode: 1,
        hide_placeholders: '["■","❔","❓"]',
        expired_time_offset: 0,
        disabled: ''
    }
}