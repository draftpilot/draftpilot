import React from 'react'

interface MarkdownParserProps {
  inputString: string
}

const MarkdownParser: React.FC<MarkdownParserProps> = ({ inputString }) => {
  const parseMarkdown = (input: string) => {
    const elements: React.ReactNode[] = []
    let currentText = ''
    let i = 0

    const pushCurrentText = () => {
      if (currentText) {
        elements.push(currentText)
        currentText = ''
      }
    }

    while (i < input.length) {
      if (input[i] === '*' && input[i + 1] === '*') {
        const markEnd = input.indexOf('**', i + 2)
        if (markEnd > -1) {
          const sliced = input.slice(i + 2, markEnd)
          if (!sliced.includes('\n')) {
            pushCurrentText()
            elements.push(<b key={i}>{sliced}</b>)
            i = markEnd + 2
            continue
          }
        }
      } else if (input[i] === '*') {
        const markEnd = input.indexOf('*', i + 1)
        if (markEnd > -1) {
          const sliced = input.slice(i + 1, markEnd)
          if (!sliced.includes('\n')) {
            pushCurrentText()
            elements.push(<i key={i}>{sliced}</i>)
            i = markEnd + 1
            continue
          }
        }
      } else if (input[i] === '`') {
        const markEnd = input.indexOf('`', i + 1)
        if (markEnd > -1) {
          const sliced = input.slice(i + 1, markEnd)
          if (!sliced.includes('\n')) {
            pushCurrentText()
            elements.push(<code key={i}>{sliced}</code>)
            i = markEnd + 1
            continue
          }
        }
      } else if (input.slice(i, i + 4) == '---\n') {
        pushCurrentText()
        elements.push(<hr key={i} />)
        i += 4
        continue
      }

      currentText += input[i]
      i++
    }

    if (currentText) {
      elements.push(currentText)
    }

    return elements
  }

  return <div className="whitespace-pre-wrap">{parseMarkdown(inputString)}</div>
}

export default MarkdownParser
