// generic helper functions
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function crossOriginFetch(url:string, args:RequestInit) {
  const requestArgs:RequestInit = {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({url, ...args})
  };
  const response = await fetch("http://localhost:5000/api/cross", requestArgs)
  return response
}
export async function authFetch(endpoint:string, token:string, method:string='GET', body?:any):Promise<Response> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const args:RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }

  const response = await crossOriginFetch(endpoint, args);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
}

export function getDatetime() {
  const now = new Date()
  return now.toDateString()
}

export async function getContentChunks(content:string):Promise<Array<string>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  return await splitter.splitText(content)
}

export const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))
export const cleanStringToAscii = str => [...str].filter(char => char.charCodeAt(0) <= 127).join('');
