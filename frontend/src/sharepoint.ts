// Microsoft Graph & Sharepoint functions
import { getContentChunks } from './helpers'

/**
 * Queries Sharepoint JWT
 * @param clientId Found in Active Directory
 * @param clientSecret Found in Active Directory
 * @param tenant_id Found in Active Directory
 * @returns JWT bearer for future requests on behalf of client
 */
export function getAccessToken(clientId:string, clientSecret:string, tenant_id:string):string {
  const token_url = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`
  const tokenPayload = {
    'grant_type': 'client_credentials',
    'client_id': clientId,
    'client_secret': clientSecret,
    'scope': 'https://graph.microsoft.com/.default'
  }
  const response = requests.post(token_url, data=tokenPayload)
  const access_token = response.json().get('access_token')
  return access_token
}

/**
 *Query Microsoft Graph API (https://graph.microsoft.com/v1.0/) and return the reponse
 * @param authToken Sharepoint Authentication Token
 * @param path Microsoft Graph API endpoint path (i.e. "me/drive/root/children")
 * @param method HTTP request method of literals "GET", "POST", "DELETE", "PUT", "PATCH"
 * @param dataPayload optional payload to pass in request data parameter
 * @return response
 */
export function sendMSGraphRequest(authToken:string, path:string, method:string, dataPayload={}) {
  const request_url = `https://graph.microsoft.com/v1.0/${path}`
  // TODO: Send auth query
  return sendAuthRequest(authToken,request_url, method, dataPayload)
}

/**
 * Get text content from Sharepoint file
 * @param authToken Sharepoint Auth Token
 * @param document_id id of file in sharepoint
 */
export function getSharepointDocument(authToken:string, document_id:string):string {
  //get PDF file from sharepoint
  const sharepoint_file_endpoint = `me/drive/items/${document_id}/content`
  const response = sendMSGraphRequest(authToken, sharepoint_file_endpoint, "GET")
  // TODO: trasnform PDF from OneDrive to text string
  if (response.status_code == 200) {
    if ('application/pdf' in response.headers.get('Content-Type', '')) {
      console.log("is PDF\n")
      const pdf_content = BytesIO(response.content)
      try {
        const text:string = extract_text(pdf_content)
        return text
      } catch(e) {
        console.log("Error while extracting text:", e)
      }
    } else {
      console.log(`The downloaded content is not a PDF: type=${response.headers.get('Content-Type', '')}`)
    }
  } else {
    console.log(`Error downloading file: ${response.text}`)
  }
  return ""
}


/**
 * Get document chunk (piece) from Sharepoint file
 * @param authToken Sharepoint Auth Token
 * @param document_id id of file in sharepoint
 * @param chunkIndex index of chunk in document. document_index > len(<document chunks>) => document_index = len(<document chunks>) - 1
 * @returns specific indicated chunk as a string of text
 */
export function getSharepointChunk(authToken:string, document_id:string, chunkIndex:number):string {
  // get entire document content
  const full_file_text = getSharepointDocument(authToken, document_id)

  // split into normal chunks using standard method
  const chunks = getContentChunks(full_file_text)
  if (chunkIndex >= chunks.length) chunkIndex = chunks.length - 1

  return chunks[chunkIndex]
}

/**
 * Request the associated email with the provided Microsoft Graph API Access Token
 * @param authToken Sharepoint Auth Token
 * @return user email or error code
 */
export function getUserEmailByToken(authToken:string):string {
  try {
    const response = sendMSGraphRequest(authToken,'me', 'GET')
    return response.json()['mail']
  } catch(e) {
    return `ERROR: Failed to get user email.\n${e}`
  }
}

/**
 * Check if user has access to some file
 * @param authToken   Sharepoint Auth Token
 * @param documentId  id of file in sharepoint 
 * @return !!(user has access) or Error
 */
export function userHasAccessToFile(authToken:string, documentId:string):boolean|string {
  const permissionEndpoint = `me/drive/items/${documentId}`
  try {
    const response = sendMSGraphRequest(authToken, permissionEndpoint, "GET")
    // TODO response code management
    if response.code === 200 {
      return true 
    } else if (response.code === 404){
      return false
    } else {
      throw Error(response)
    }
  } catch(e) {
    return `ERROR: cannot determine file access.\n${e}`
  }
}