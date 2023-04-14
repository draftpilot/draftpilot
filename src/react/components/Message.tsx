type Props = {
  message?: string
  fromUser?: boolean
  loading?: boolean
}

const Message = ({ message, fromUser, loading }: Props) => {
  const style = fromUser ? 'bg-white' : 'bg-blue-300'

  const messageContent = () => {
    if (loading || !message) return <div className="dot-flashing ml-4 my-2" />
    if (message.startsWith('Thought:')) return <span className="italic">{message}</span>

    if (message.startsWith('PROPOSAL:')) {
      const proposal = message.substring(9)
      return (
        <>
          <div className="font-bold">Proposed Action:</div>
          {proposal}
        </>
      )
    }
    if (message.startsWith('ANSWER:')) {
      const answer = message.substring(7)
      return <span className="font-bold">{answer}</span>
    }

    return message
  }

  return <div className={`${style} p-4 shadow-md rounded`}>{messageContent()}</div>
}

export default Message
