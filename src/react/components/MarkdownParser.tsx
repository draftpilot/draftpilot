import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownParserProps {
  inputString: string
}

const MarkdownParser: React.FC<MarkdownParserProps> = ({ inputString }) => {
  return <ReactMarkdown>{inputString}</ReactMarkdown>
}

export default MarkdownParser
