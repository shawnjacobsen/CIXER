// generic helper functions
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function authFetch(endpoint:string, token:string, method:string='GET', body?:any):Promise<any> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const requestOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(endpoint, requestOptions);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export function get_datetime() {
  const now = new Date()
  return now.toDateString()
}

export async function getContentChunks(content:string):Promise<Array<string>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 1,
  });
  return await splitter.splitText(content)
}

export const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))
export const cleanStringToAscii = str => [...str].filter(char => char.charCodeAt(0) <= 127).join('');