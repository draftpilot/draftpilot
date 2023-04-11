import { encode, decode } from 'gpt-3-encoder'

// Tokenize a text into words
function tokenize(text: string): string[] {
  // split words, normalize, remove punctuation
  return text.split(/[^a-zA-Z0-9]/).map((word) => word.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''))
}

// Build a vocabulary from a list of texts
function buildVocabulary(texts: string[]): Set<string> {
  const vocabulary = new Set<string>()
  for (const text of texts) {
    const words = tokenize(text)
    for (const word of words) {
      vocabulary.add(word)
    }
  }
  return vocabulary
}

const docTokenCache = new Map<string, string[]>()

// Calculate the term frequency of a word in a document
function calculateTermFrequency(word: string, document: string): number {
  let doctokens: string[] = []
  if (docTokenCache.has(document)) {
    doctokens = docTokenCache.get(document)!
  } else {
    doctokens = tokenize(document)
    docTokenCache.set(document, doctokens)
  }

  return doctokens.filter((t) => t === word).length / doctokens.length
}

// Calculate the inverse document frequency of a word in a list of documents
function calculateInverseDocumentFrequency(word: string, documents: string[]): number {
  // count how many documents contain word, divide by total number of documents, take logarithm
  const numDocumentsContainingWord = documents.filter((document) => {
    let doctokens: string[] = []
    if (docTokenCache.has(document)) {
      doctokens = docTokenCache.get(document)!
    } else {
      doctokens = tokenize(document)
      docTokenCache.set(document, doctokens)
    }

    return doctokens.includes(word)
  }).length

  if (numDocumentsContainingWord === 0) return 0

  return Math.log(documents.length / numDocumentsContainingWord)
}

// Create a tf-idf matrix from a list of documents and a vocabulary
function createTfIdfMatrix(documents: string[], vocabulary: Set<string>): number[][] {
  const tfIdfMatrix = []
  for (const document of documents) {
    const tfIdfVector = []
    for (const word of vocabulary) {
      const tf = calculateTermFrequency(word, document)
      const idf = calculateInverseDocumentFrequency(word, documents)
      const tfIdf = tf * idf
      tfIdfVector.push(tfIdf)
    }
    tfIdfMatrix.push(tfIdfVector)
  }
  return tfIdfMatrix
}

// Calculate the cosine similarity between two vectors
function calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i]
    norm1 += vector1[i] ** 2
    norm2 += vector2[i] ** 2
  }
  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)
  const cosineSimilarity = dotProduct / (norm1 * norm2)
  return cosineSimilarity
}

// Find the most similar documents to a query
export function findSimilarDocuments(query: string, documents: string[]): string[] {
  const vocabulary = buildVocabulary([query, ...documents])
  const tfIdfMatrix = createTfIdfMatrix(documents, vocabulary)
  const queryTfIdfVector: number[] = []
  for (const word of vocabulary) {
    const tf = calculateTermFrequency(word, query)
    const idf = calculateInverseDocumentFrequency(word, documents)
    const tfIdf = tf * idf
    queryTfIdfVector.push(tfIdf)
  }
  const cosineSimilarities = tfIdfMatrix.map((documentVector) => {
    return calculateCosineSimilarity(queryTfIdfVector, documentVector)
  })
  const sortedDocuments = documents.slice().sort((a, b) => {
    const indexA = documents.indexOf(a)
    const indexB = documents.indexOf(b)
    return cosineSimilarities[indexB] - cosineSimilarities[indexA]
  })
  return sortedDocuments
}
