/** Class to manage pinecone requests */
import { RequestHandler } from "./RateLimiter"

interface Match {
  id:string
  score?:any
  values?:any
  metadata?:{
    document_id:string
    chunk_index:number
    [x: string | number | symbol]: unknown
  }
  [x: string | number | symbol]: unknown;
}

export class Pinecone {
  baseUrl:string
  apiKey:string
  request:RequestHandler
  constructor(indexName:string, projectId:string, environment:string, apiKey:string) {
    this.baseUrl = `https://${indexName}-${projectId}.svc.${environment}.pinecone.io`
    this.apiKey = apiKey
    this.request = new RequestHandler(1000, 3)
  }

  public getBaseUrl() { return this.baseUrl }
  public getApiKey() { return this.apiKey }

  /**
   * queries similar vectors from Pinecone given some vector
   * @param vector the vector to compare against
   * @param topK the number of top similar vectors to return
   * @param includeValues include the vector values
   * @param includeMetadata include additional vector metadata
   * @param filter Pinecone filters
   * @returns the list of matches [{'id','score','values', 'metadata':{ 'item_id', 'chunk_index' }}]
   */
  public async queryVectors(vector:Array<number>,
    topK:number,
    includeValues:boolean=false,
    includeMetadata:boolean=false,
    filter?:{[key: string]: any},
    ):Promise<Array<Match>> {
      const headers = {
        'Api-Key':this.getApiKey(),
        'Accept': 'application/json',
        'content-type': 'application/json'
      }

      const data = {
        'vector': vector,
        'topK': topK,
        'includeValues':includeValues,
        'includeMetadata':includeMetadata
      }
      if (filter) { data['filter'] = filter }

      const url = this.getBaseUrl()
      const response:Response = await this.request.sendRequest(url,{
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      })
      console.log("RESPONSE:")
      console.log(response)
      const results = await response.json()

      return results['matches']
  }

  public upsert(vector:Array<number>) {}

}