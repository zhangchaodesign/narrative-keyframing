import { BaseEditor, BaseRange } from 'slate'
import { ReactEditor } from 'slate-react'

type CustomText = {
  text: string
  added?: boolean
  removed?: boolean
  highlight?: boolean
}

type CustomElement = {
  type: 'paragraph'
  children: CustomText[]
}

type CustomRange = BaseRange & {
  highlight?: boolean
  added?: boolean
  removed?: boolean
}

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: CustomText
    Range: CustomRange
  }
}
