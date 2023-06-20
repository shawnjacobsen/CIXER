// handle any bot related behavior including Q/A and embedding
import { Configuration, OpenAIApi } from 'openai'
import { getSharepointChunk, userHasAccessToFile, getSharepointDocumentLink } from './sharepoint'
import { cleanStringToAscii, sleep, getDatetime } from './helpers'
import { Link, Message } from './Chatbox'

export class Bot {
  openai:OpenAIApi
  lastQuestionAnswer:{'prompter':string,'responder':string}
  constructor() {
    this.openai = this.getOpenAIApiObject()
    this.lastQuestionAnswer = {'prompter':"",'responder':""}
  }
  public getOpenAIApiObject():OpenAIApi {
    const configuration = new Configuration({
      apiKey: process.env.REACT_APP_KEY_OPENAI,
    });
    const openai = new OpenAIApi(configuration)
    return openai
  }

  public async gptEmbedding(content:string, model='text-embedding-ada-002'):Promise<Array<number>> {
    content = content.replace(/[^\x00-\x7F]/g, "")
    const response = await this.openai.createEmbedding({
      model:model,
      input:content
    })
    return response['data']['data'][0]['embedding']
  }

  /**
   * Return Sharepoint documents similar to some vector which are accessible to the specified user as a single combined text string
   * @param authToken Active Directory user access token
   * @param vector the vector to search for similar vectors of in the vector database
   * @param k number of semantically similar documents to poll for at a time. Defaults to 6.
   * @param threshold min number of documents to return. Defaults to 2.
   * @param maxTries number of repolls to reach threshold. Defaults to 3.
   * @param infoSeparator text separator indicator used when joininig all gathered information
   * @returns concatentated list of similar documents content
   */
  public async retrieveAccessibleSimilarInformation(
    authToken:string,
    vector:Array<number>,
    k:number=2,
    threshold:number=2,
    maxTries:number=3,
    infoSeparator:string=" -- "
  ):Promise<[Array<Link>, string]> {

    let previouslyQueriedVectors = []
    let numAccessibleDocuments = 0
    let accessibleDocuments = ""
    let documentLinks:Array<Link> = []
    let tries = 0

    while (numAccessibleDocuments < threshold && tries < maxTries) {
      // for current try, retrieve k + number of previously queried vectors to get new vectors
      const numVectorsToRetrieve = k + previouslyQueriedVectors.length

      // get matches from vector
      const queryRequest = {
        vector,
        topK:numVectorsToRetrieve,
        includeValues: false,
        includeMetadata: true
      }
      const url = `${process.env.REACT_APP_SERVER_URL}/api/pinecone/query`
      const res = await fetch(url, {
        'method':'POST',
        'headers': {'content-type': 'application/json'},
        'body': JSON.stringify({'queryRequest':queryRequest})
      })
      const results = await res.json()
      let matches = results.matches
      const ids = matches.map(match => match['id'])
      console.log('matches',matches)

      // filter out elements in matches whose id is in previouslyQueriedVectors
      console.log("previouslyQueriedVectors",[...previouslyQueriedVectors])
      matches = matches.filter(match => !previouslyQueriedVectors.includes(match['id']))
      console.log("new matches:", [...matches].length)
      // if the user has access to the chunk's content, append it to the result
      const promises = matches.map(async match => {
        const docId = match['metadata']['document_id']
        const chunkIndex = match['metadata']['chunk_index']
        const userHasAccess = await userHasAccessToFile(authToken, docId)
        if (userHasAccess === true) {
          const docContents = await getSharepointChunk(authToken, docId, chunkIndex)
          const link = await getSharepointDocumentLink(authToken, docId)
          documentLinks.push(link)
          accessibleDocuments += docContents + infoSeparator
          numAccessibleDocuments += 1

          console.log("doc id:",docId)
          console.log("content:",docContents)
        }
      })
      await Promise.all(promises)
      
      // increment number of tries and update previously queried vectors
      previouslyQueriedVectors.concat(ids)
      tries += 1
    }
    return [documentLinks, accessibleDocuments]
  }

  /**
   * Get answer to some generic text prompt via OpenAI's GPT models
   * @param openai OpenAI object 
   * @param prompt Entire text prompt to be provided to model
   * @param model specified OpenAI model to use
   * @param temp model temp
   * @param top_p model parameter
   * @param tokens max tokens in response
   * @param freq_pen model parameter
   * @param pres_pen model parameter
   * @param stop 
   * @return model's response to the prompt
   */
  public async gptCompletion(
    prompt:string,
    model:string='text-davinci-003',
    temp=0.0,
    top_p=1.0,
    tokens=400,
    freq_pen=0.0,
    pres_pen=0.0,
    stop=['USER:', 'ASSISTANT:']
  ):Promise<string> {

    const maxRetry = 5
    let retry = 0

    // fix any possible ascii issues
    prompt = cleanStringToAscii(prompt)

    while (true) {
      try {
        const response:any = await this.openai.createCompletion({
          model:model,
          prompt: prompt,
          temperature: temp,
          max_tokens: tokens,
          top_p: top_p,
          frequency_penalty: freq_pen,
          presence_penalty: pres_pen,
          stop: stop
        })
        let text = response.data.choices[0].text
        text.replace('\r\n','\n')
        text.replace('\t','  ')
        return text
      } catch(e) {
        retry += 1
        console.log(`ERROR: Could not communicate with OpenAI.\n${e}`)
        if (retry > maxRetry) {
          return "Sorry, I am unable to respond to that right now. Please try again later."
        }
        sleep(1000)
      }
    }
  }

  /**
   * constrcits a prompt with conversational context and information to be fed to the LLM
   * @param previousPrompterMsg message from previous Q/A exchange for context
   * @param previousResponderMsg message from previous Q/A exchange for context
   * @param currPrompterMsg current prompter's message to be responded to
   * @param contextInfo any additional info to be provided to the model
   * @param promptTemplate text file location of prompt template
   * @return constructed prompt
   */
  public async constructPrompt(
    currPrompterMsg:string,
    contextInfo:string,
    promptTemplate:string='/prompt.txt'
  ):Promise<string> {
    const response = await fetch(promptTemplate)
    let prompt = await response.text()
    prompt = prompt.replace("<<USER CONTEXT>>", this.lastQuestionAnswer['prompter'])
    prompt = prompt.replace("<<BOT CONTEXT>>", this.lastQuestionAnswer['responder'])
    prompt = prompt.replace("<<MESSAGE>>", currPrompterMsg)
    prompt = prompt.replace("<<INFO>>", contextInfo)
    return prompt
  }

  /**
   * get bot response to some message
   * @param message the message to be responded to
   * @param authToken Active Directory user access token
   * @param queryDocuments whether the prompt should be enriched with additional docs or not
   * @returns the links to documents used to answer the question and the response message
   */
  public async getResponse(message:Message, authToken:string, queryDocuments:boolean):Promise<Message> {
    // vectorize message
    const messageVector = await this.gptEmbedding(message['text'])

    /** get bot response */
    let links = []
    let similarInfo = ""
    if (queryDocuments) {
      [links, similarInfo] = await this.retrieveAccessibleSimilarInformation(authToken, messageVector, 1)
    }
    const prompt = await this.constructPrompt(message['text'], similarInfo)
    const textResponse = await this.gptCompletion(prompt)
    const botMessage:Message = {
      'text': textResponse,
      'user': 'Bot',
      'links': links
    }

    // generate metadata
    const userMetadata = { 'email': message['email'], 'speaker': 'User', 'timestring': getDatetime()}
    const botMetadata = {'speaker': 'BOT', 'timestring': getDatetime()}
    const log = {
      bot: {'metadata': botMetadata, 'message':textResponse},
      user: {'metadata': userMetadata, 'message':message['text']},
      info: similarInfo
    }

    return botMessage
  }
}