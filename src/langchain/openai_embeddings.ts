import { Configuration, ConfigurationParameters, CreateEmbeddingRequest, OpenAIApi } from 'openai'

import { ServerAPI } from '../api.js'
import { Embeddings, EmbeddingsParams } from './embeddings.js'
import { chunkArray } from './util.js'
import { verboseLog } from '@/utils/logger.js'

interface ModelParams {
  /** Model name to use */
  modelName: string

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number
}

export class OpenAIEmbeddings extends Embeddings implements ModelParams {
  modelName = 'text-embedding-ada-002'

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the OpenAI API to a maximum of 2048.
   */
  batchSize = 512

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines = true

  timeout?: number

  verbose: boolean = false

  private client?: OpenAIApi

  private clientConfig: ConfigurationParameters

  constructor(
    fields?: Partial<ModelParams> &
      EmbeddingsParams & {
        verbose?: boolean
        batchSize?: number
        openAIApiKey?: string
        stripNewLines?: boolean
      },
    configuration?: ConfigurationParameters
  ) {
    super(fields ?? {})

    const apiKey =
      fields?.openAIApiKey ??
      // eslint-disable-next-line no-process-env
      (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined)
    if (!apiKey) {
      throw new Error('OpenAI API key not found')
    }

    this.verbose = fields?.verbose ?? this.verbose
    this.modelName = fields?.modelName ?? this.modelName
    this.batchSize = fields?.batchSize ?? this.batchSize
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines
    this.timeout = fields?.timeout

    this.clientConfig = {
      apiKey,
      ...configuration,
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replaceAll('\n', ' ')) : texts,
      this.batchSize
    )

    const embeddings: number[][] = []

    for (let i = 0; i < subPrompts.length; i += 1) {
      try {
        const input = subPrompts[i].filter(Boolean)
        const { data } = await this.embeddingWithRetry({
          model: this.modelName,
          input,
        })
        for (let j = 0; j < input.length; j += 1) {
          embeddings.push(data.data[j].embedding)
        }
        if (this.verbose)
          console.log('(embeddings): processed batch', i + 1, 'of', subPrompts.length)
      } catch (e: any) {
        console.error('error in embeddings batch', i)
        if (this.verbose) {
          const unwrapped = ServerAPI.unwrapError(e)
          const message = typeof unwrapped === 'string' ? unwrapped : JSON.stringify(unwrapped)
          process.stdout.write(message)
          process.stdout.write('\n')
        }
      }
    }

    return embeddings
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const { data } = await this.embeddingWithRetry({
        model: this.modelName,
        input: this.stripNewLines ? text.replaceAll('\n', ' ') : text,
      })
      return data.data[0].embedding
    } catch (e: any) {
      console.error('Error in embedQuery:', ServerAPI.unwrapError(e))
      return []
    }
  }

  private async embeddingWithRetry(request: CreateEmbeddingRequest) {
    if (!this.client) {
      const clientConfig = new Configuration({
        ...this.clientConfig,
        baseOptions: {
          timeout: this.timeout,
          ...this.clientConfig.baseOptions,
        },
      })
      this.client = new OpenAIApi(clientConfig)
    }
    return this.caller.call(this.client.createEmbedding.bind(this.client), request)
  }
}
