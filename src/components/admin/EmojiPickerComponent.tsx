import React, { useState } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SmilePlus } from 'lucide-react'

interface EmojiPickerComponentProps {
  value: string
  onChange: (emoji: string) => void
  placeholder?: string
}

export const EmojiPickerComponent: React.FC<EmojiPickerComponentProps> = ({
  value,
  onChange,
  placeholder = 'Select emoji'
}) => {
  const [open, setOpen] = useState(false)

  const handleEmojiClick = (emojiObject: any) => {
    onChange(emojiObject.emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal border-border bg-input"
          title={placeholder}
        >
          <SmilePlus className="h-4 w-4 mr-2" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-border" align="start">
        <div className="p-3 bg-card rounded-lg">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="auto"
            width="100%"
            height={400}
            defaultSkinTone="neutral"
            searchDisabled={false}
            previewConfig={{ defaultCapitalizedCategory: true }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
