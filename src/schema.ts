export interface ThideText {
    text: string,
    mode: 'inline' | 'message',
    type: number
}

export interface domainPathParamsList {
    [key: string]: {
        [key: string]: Array<string>
    }
}
export interface domainPathUrlReplaceList {
    [key: string]: {
        [key: string]: Array<[string, string]>
    }
}