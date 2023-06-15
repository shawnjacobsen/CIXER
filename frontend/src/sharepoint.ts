// Microsoft Graph & Sharepoint functions
import { getContentChunks, authFetch } from './helpers'
import { AccessTokenResponse } from 'react-aad-msal';
import { AzureAD, AuthenticationState } from 'react-aad-msal';
import { MsalAuthProvider, LoginType } from 'react-aad-msal';


/**
 * Queries Sharepoint MSAL AuthProvider
 * @param clientId Found in Active Directory
 * @param tenant_id Found in Active Directory
 * @returns JWT bearer for future requests on behalf of client
 */
export async function getAuthProvider(clientId:string, tenant_id:string):Promise<MsalAuthProvider> {
  // Config
  const config = {
    auth: {
      authority: `https://login.microsoftonline.com/${tenant_id}`,
      clientId: clientId,
    },
  };

  // Authentication Parameters
  const authenticationParameters = {
    scopes: ['user.read', 'Files.Read'],
  };

  // Options
  const options = {
    loginType: LoginType.Redirect,
    tokenRefreshUri: window.location.origin + '/auth.html',
  };

  const authProvider:MsalAuthProvider = new MsalAuthProvider(config, authenticationParameters, options);
  return authProvider
}

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
  return await authFetch(request_url, authToken, method, dataPayload)
}

/**
 * Get text content from Sharepoint file
 * @param authToken Sharepoint Auth Token
 * @param document_id id of file in sharepoint
 */
export async function getSharepointDocument(authToken:string, document_id:string):Promise<string> {
  try {
    // Query the Microsoft Graph API to get the DriveItem
    const driveItemResponse = await sendMSGraphRequest(authToken, `me/drive/items/${document_id}`, 'GET');

    // Check if the DriveItem is a file
    if (driveItemResponse.file) {
      // If the DriveItem is a file, we can get its content
      const contentResponse = await sendMSGraphRequest(authToken, `me/drive/items/${document_id}/content`, 'GET');

      // Assume contentResponse is Blob, convert it to text
      const contentText = await contentResponse.text();

      return contentText;
    } else {
      throw new Error('The specified DriveItem is not a file');
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Get document chunk (piece) from Sharepoint file
 * @param authToken Sharepoint Auth Token
 * @param document_id id of file in sharepoint
 * @param chunkIndex index of chunk in document. document_index > len(<document chunks>) => document_index = len(<document chunks>) - 1
 * @returns specific indicated chunk as a string of text
 */
export async function getSharepointChunk(authToken:string, document_id:string, chunkIndex:number):Promise<string> {
  // get entire document content
  const full_file_text = await getSharepointDocument(authToken, document_id)

  // split into normal chunks using standard method
  const chunks = await getContentChunks(full_file_text)
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
    const response = await sendMSGraphRequest(authToken,'me', 'GET')
    const email:string = response.json()['mail']
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
export function userHasAccessToFile(authToken:string, documentId:string):boolean|string {
  const permissionEndpoint = `me/drive/items/${documentId}`
  // try {
  //   const response = sendMSGraphRequest(authToken, permissionEndpoint, "GET")
  //   // TODO response code management
  //   if response.code === 200 {
  //     return true 
  //   } else if (response.code === 404){
  //     return false
  //   } else {
  //     throw Error(response)
  //   }
  // } catch(e) {
  //   return `ERROR: cannot determine file access.\n${e}`
  // }
  return true
}