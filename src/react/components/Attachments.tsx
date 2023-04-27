import { messageStore } from '@/react/stores/messageStore'
import { Attachment } from '@/types'
import {
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  RectangleStackIcon,
  WrenchIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export function Attachments({
  attachments,
  canDelete,
}: {
  attachments: Attachment[]
  canDelete?: boolean
}) {
  return (
    <div className="flex flex-row gap-2 flex-wrap mt-2">
      {attachments.map((attachment, i) => (
        <div key={i} className="bg-white p-2 shadow rounded flex items-center">
          <AttachmentBody attachment={attachment} />
          {canDelete && (
            <div
              onClick={() => messageStore.deleteAttachment(attachment)}
              className="ml-2 text-gray-500 hover:text-red-500 cursor-pointer"
            >
              <XMarkIcon className="h-4 w-4" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
function AttachmentBody({ attachment }: { attachment: Attachment }) {
  const Icon =
    attachment.type == 'file'
      ? DocumentTextIcon
      : attachment.type == 'observation'
      ? attachment.name.startsWith('find')
        ? MagnifyingGlassIcon
        : attachment.name.startsWith('list')
        ? RectangleStackIcon
        : attachment.name.startsWith('view')
        ? DocumentMagnifyingGlassIcon
        : WrenchIcon
      : PaperClipIcon

  return (
    <>
      <Icon className="h-4 w-4 text-gray-500 mr-2" />
      {attachment.name}
    </>
  )
}
