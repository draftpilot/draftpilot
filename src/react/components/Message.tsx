type Props = {
  message?: string
  fromUser?: boolean
  loading?: boolean
}

const Message = ({ message, fromUser, loading }: Props) => {
  const style = fromUser ? 'bg-white' : 'bg-blue-300'
  return (
    <div className={`${style} p-4 shadow-md rounded`}>
      {loading ? <div className="dot-flashing ml-4 my-2" /> : message}
    </div>
  )
}

export default Message
