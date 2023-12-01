// Microsoft Graph & Sharepoint functions
import { getContentChunks, authFetch, crossOriginFetch } from './helpers'
import { Link } from './Chatbox'

export const getAccessToken = async (code: string | null, setToken: React.Dispatch<React.SetStateAction<string | null>>) => {
  const tokenURL: string = `https://login.microsoftonline.com/${process.env.REACT_APP_AD_TENANT_ID}/oauth2/v2.0/token`;

  const details = {
    client_id: process.env.REACT_APP_AD_APP_ID,
    scope: 'Files.ReadWrite.All offline_access',
    code: code,
    redirect_uri: process.env.REACT_APP_REDIRECT_URL,
    grant_type: 'authorization_code',
  };

  let formBody: string[] = [];
  for (const property in details) {
    const encodedKey: string = encodeURIComponent(property);
    const encodedValue: string = encodeURIComponent(details[property]);
    formBody.push(encodedKey + "=" + encodedValue);
  }

  const formBodyString: string = formBody.join("&");  // New line, formBodyString will be a string now

  try {
    const response: Response = await crossOriginFetch(tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: formBodyString  // Replace formBody with formBodyString
    });

    const data: {access_token: string} = await response.json();
    setToken(data.access_token);
  } catch (error) {
    console.log('Error:', error);
  }
};

/**
 *Query Microsoft Graph API (https://graph.microsoft.com/v1.0/) and return the reponse
 * @param authToken Sharepoint Authentication Token
 * @param path Microsoft Graph API endpoint path (i.e. "me/drive/root/children")
 * @param method HTTP request method of literals "GET", "POST", "DELETE", "PUT", "PATCH"
 * @param dataPayload optional payload to pass in request data parameter
 * @return response
 */
export async function sendMSGraphRequest(authToken:string, path:string, method:string, dataPayload={}):Promise<any> {
  const request_url = `https://graph.microsoft.com/v1.0/${path}`
  const res = await authFetch(request_url, authToken, method, dataPayload)
  return res
}

/**
 * Get text content from Sharepoint file
 * @param authToken Sharepoint Auth Token
 * @param driveId id of the drive the file is in
 * @param documentId id of file in sharepoint
 */
export async function getSharepointDocument(authToken:string, driveId:string, documentId:string):Promise<string|null> {
  try {
    // get document's text from server
    const body = {
      'authToken': authToken,
      'driveId': driveId,
      'documentId': documentId
    }
    const url = `${process.env.REACT_APP_SERVER_URL}/api/sharepoint/getDocumentContent`
    const res = await fetch(url, {
      'method':'POST',
      'headers': {'content-type': 'application/json'},
      'body': JSON.stringify(body)
    })
    return await res.text();
  } catch (error) {
    console.error(error);
    return null
  }
}

/**
 * 
 * @param authToken Active Directory Auth Token
 * @param driveId id of the drive the file is in
 * @param documentId id of file in sharepoint
 * @returns 
 */
export async function getSharepointDocumentLink(authToken:string, driveId:string, documentId:string):Promise<Link> {
  let link:Link = {name:"",href:""}
  try {
    const res = await sendMSGraphRequest(authToken, `drives/${driveId}/items/${documentId}`,'GET')
    const body = await res.json()
    link['name'] = body.name
    link['href']  = body.webUrl
  } catch (error) {
    throw new Error(`Unable to get sharepoint link and name\n${error}`)
  }
  return link
}

/**
 * Get document chunk (piece) from Sharepoint file
 * @param authToken Active Directory Auth Token
 * @param driveId id of the drive the file is in
 * @param documentId id of file in sharepoint
 * @param chunkIndex index of chunk in document. document_index > len(<document chunks>) => document_index = len(<document chunks>) - 1
 * @returns specific indicated chunk as a string of text or null if could not retrieve (e.g. insufficient permissions)
 */
export async function getSharepointChunk(authToken:string, driveId:string, documentId:string, chunkIndex:number):Promise<string|null> {
  // get entire document content
  const fullFileText = await getSharepointDocument(authToken, driveId, documentId)
  if (!fullFileText) { return null }
  
  // split into normal chunks using standard method
  const chunks = await getContentChunks(fullFileText)
  if (chunkIndex >= chunks.length) chunkIndex = chunks.length - 1

  return chunks[chunkIndex]
}

/**
 * Request the associated email with the provided Microsoft Graph API Access Token
 * @param authToken Sharepoint Auth Token
 * @return user email or error code
 */
export async function getUserEmailByToken(authToken:string):Promise<string> {
  try {
    const res = await sendMSGraphRequest(authToken,'me', 'GET')
    const body = await res.json()
    const email:string = body['mail']
    return email
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
export async function userHasAccessToFile(authToken:string, documentId:string):Promise<boolean> {
  const permissionEndpoint = `me/drive/items/${documentId}`
  try {
    const response = await sendMSGraphRequest(authToken, permissionEndpoint, "GET")
    if (response.status === 200) {
      return true;
    } else if (response.status === 404) {
      return false;
    } else {
      throw new Error(`Error occurred while checking access to file: ${response.statusText}`);
    }
  } catch(e) {
    console.log(`ERROR: cannot determine file access.\n${e}`)
    return false
  }
}