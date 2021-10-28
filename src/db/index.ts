import { PrismaClient, userSetting as TuserSetting } from '@prisma/client'
import { DuserSetting } from '../default'

export const prisma = new PrismaClient()

// get usersetting 
export const d_get_userSetting = async (user_id: bigint | number) => {
    const userSetting = (await prisma.userSetting.findFirst({
        where: {
            user_id: user_id
        }
    })) || DuserSetting(user_id)
    return userSetting
}