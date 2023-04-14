type Props = {
  message: string
  fromUser?: boolean
}

const Message = ({ message, fromUser }: Props) => {
  const style = fromUser ? 'bg-white' : 'bg-blue-300'
  return <div className={`${style} p-4 shadow-md rounded`}>{message}</div>
}

export default Message
