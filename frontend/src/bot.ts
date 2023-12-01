// handle any bot related behavior including Q/A and embedding
import { Configuration, OpenAIApi, CreateChatCompletionRequest, ChatCompletionFunctions } from 'openai';
import { getSharepointChunk, getSharepointDocumentLink } from './sharepoint';
import { Link, Message } from './Chatbox';

export interface VectorMetadata {
	name: string				// the file's name
  drive_id: string;		// the drive id (id of some personal OneDrive, Sharepoint site, etc.)
  item_id: string;		// the id of the item
  location: 'onedrive' | 'sharepoint';
	chunk_index?: number // in the chunked (Array<string>) version of the document, the index the vector refers to out of the entire item
	user?: string				// user associated with the parent drive
};

/**
 * retrieve the an authenticated version of the openai object
 * @returns openai authenticated object
 */
export function getOpenAIApiObject(): OpenAIApi {
	const configuration = new Configuration({
		apiKey: process.env.REACT_APP_KEY_OPENAI
	});
	const openai = new OpenAIApi(configuration);
	return openai;
}

/**
 * Generates an embedding for the given content using the specified model.
 * @param content : The text content to generate an embedding for. Non-ASCII characters are removed from the content.
 * @param openai authenticated OpenAI API object
 * @param model : The name of the model to use for generating the embedding. Defaults to 'text-embedding-ada-002'.
 * @returns : A promise that resolves to an array of numbers representing the embedding.
 */
export async function gptEmbedding(content: string, openai:OpenAIApi, model = 'text-embedding-ada-002'): Promise<Array<number>> {
	content = content.replace(/[^\x00-\x7F]/g, '');
	const response = await openai.createEmbedding({
		model: model,
		input: content
	});
	return response['data']['data'][0]['embedding'];
}

/**
 * Return Sharepoint documents similar to some vector which are accessible to the specified user as a single combined text string
 * @param authToken Active Directory user access token
 * @param openai authenticated OpenAI API object
 * @param message the string to vectorize and search for similar vectors of in the vector database
 * @param minNumDocuments min number of documents to return. Defaults to 2.
 * @param numDocumentsToPoll number of semantically similar documents to poll for at a time. Defaults to 2.
 * @param maxTries number of repolls to reach threshold. Defaults to 3.
 * @param infoSeparator text separator indicator used when joininig all gathered information
 * @returns concatentated list of similar documents content
 */
export async function retrieveAccessibleSimilarInformation(
	authToken: string,
	openai: OpenAIApi,
	message: string,
	minNumDocuments: number = 2,
	numDocumentsToPoll: number = 2,
	maxTries: number = 10,
	infoSeparator: string = ' -- '
): Promise<[Array<Link>, string]> {

	let previouslyQueriedVectors = []; 		// vectors queried in a previous iteration so should not be queried again
	let itemIdFilter = [];								// items that should not queried (e.g. user does not have access)
	let numAccessibleDocuments = 0;				// number of accessible documents discovered
	let accessibleDocuments = '';					// concatenated string of accessible documents to be returned
	let documentLinks: Array<Link> = [];	// array of links corresponding to each returned document
	let tries = 0;												// track number of while-loop iterations

	// vectorize message
	const vector = await gptEmbedding(message, openai);

	while (numAccessibleDocuments < minNumDocuments && tries < maxTries) {
		// for current try, retrieve numDocumentsToPoll + number of previously queried vectors to get new vectors
		const numVectorsToRetrieve = numDocumentsToPoll + previouslyQueriedVectors.length;

		// get matches from vector
		const queryRequest = {
			vector,
			topK: numVectorsToRetrieve,
			includeValues: false,
			includeMetadata: true
		};
		const url = `${process.env.REACT_APP_SERVER_URL}/api/pinecone/query`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ queryRequest: queryRequest })
		});
		const results = await res.json();
		let matches = results.matches;
		const ids = matches.map((match) => match['id']);

		// filter out elements in matches whose id is in previouslyQueriedVectors
		matches = matches.filter((match) => !previouslyQueriedVectors.includes(match['id']));

		// if the user has access to the chunk's content, append it to the result
		const promises = matches.map(async (match) => {
			const metadata:VectorMetadata = match['metadata']
			const driveId = metadata['drive_id']
			const docId = metadata['item_id'];
			const chunkIndex = Math.floor(metadata['chunk_index']);
			const location = metadata['location'];

			// attempt to get the chunk TODO
			const docContents = await getSharepointChunk(authToken, driveId, docId, chunkIndex);
			if (docContents) {
				
				const link = await getSharepointDocumentLink(authToken, driveId, docId);
				documentLinks.push(link);
				accessibleDocuments += docContents + infoSeparator;
				numAccessibleDocuments += 1;
			}
		});
		await Promise.all(promises);

		// increment number of tries and update previously queried vectors
		previouslyQueriedVectors.concat(ids);
		tries += 1;
	}

	// clean duplicate links
	documentLinks = documentLinks.filter((link, index, self) => 
		index === self.findIndex(t => (
			t.href === link.href
		))
	)
	return [documentLinks, accessibleDocuments];
}

/**
 * get bot response to some message
 * @param messages the message to be responded to
 * @param authToken Active Directory user access token
 * @param openai authenticated OpenAI API object
 * @param allowFunctionCall Allow the assistant to request a function call. Defaults to true
 * @returns the links to documents used to answer the question and the response message(s) appended to the original message list
 */
export async function getResponse(messages:Array<Message>, authToken:string, openai:OpenAIApi, allowFunctionCall=true):Promise<Array<Message>> {

  // get initial assistant response and append to messages
	const completionArgs:CreateChatCompletionRequest = {
    model: "gpt-3.5-turbo-0613",
		// remove extraneous attributes ('links')
    messages: messages.map(({links, ...message}) => message),
		functions: getAvailableGPTFunctions(),
		// allow functions calls if enabled by allowFunctionCall
    function_call: allowFunctionCall ? "auto" : "none"
	}
  const completion = await openai.createChatCompletion(completionArgs)
  const completionMessage = completion['data']['choices'][0]['message']
	messages.push(completionMessage)

  // check if the assistant wants to call a function
  if (completionMessage['function_call']) {
    // call the function called by the assistant
    const functionName = completionMessage['function_call']['name']
    const args = JSON.parse(completionMessage['function_call']['arguments'])
		const minNumDocuments = Math.min(Math.max(1,args['minNumDocuments']), 5)
    const [links, info] = await retrieveAccessibleSimilarInformation(authToken, openai, args['message'], minNumDocuments)
   
    // append the called function's return value to the message array
    const functionMessage:Message = {
      role: "function",
			name: functionName,
      content: info,
    }
    messages.push(functionMessage)

    // get user-facing (no function call) assistant response using the previous function message
    messages = await getResponse(messages, authToken, openai, allowFunctionCall=false)
		
		// append the previously found document links to the user-facing message
		messages[messages.length - 1]['links'] = links
  }

  return messages
}

export function getAvailableGPTFunctions(): Array<ChatCompletionFunctions> {
	return [
		{
			name: 'retrieveAccessibleSimilarInformation',
			description: 'Return sections of Sharepoint documents that are semantically similar to the provided message parameter',
			parameters: {
				type: 'object',
				properties: {
					message: {
						type: 'string',
						description: "The message used to find semantically similar document chunks. The message should be detailed and specific to ensure accurate matching with vectors in a vector database. It should include key terms, context, and any relevant information that can help in identifying the correct document chunks."
					},
					minNumDocuments: {
						type: 'integer',
            description: "The minimum number of 1000 character document chunks likely required to properly answer the user's question. This number should be estimated based on the complexity and breadth of the user's query. A more generic question like summarization will require more document chunks."
					}
				},
				required: ['message','minNumDocuments']
			}
		}
	];
}

export async function getSystemPrompt():Promise<string> {
	const response = await fetch('/systemPrompt.txt')
	return await response.text()
}