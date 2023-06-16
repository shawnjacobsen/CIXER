/** Class to manage pinecone requests */


class Pinecone {
  baseUrl:string
  apiKey:string
  constructor(indexName:string, projectId:string, environment:string, apiKey:string) {
    this.baseUrl = `https://${indexName}-${projectId}.svc.${environment}.pinecone.io`
    this.apiKey = apiKey
  }

  public getBaseUrl() { return this.baseUrl }
  public getApiKey() { return this.apiKey }

  public async queryVectors(vector:Array<Number>,
    topK:number,
    filter?:{[key: string]: any},
    includeValues:boolean=false,
    includeMetadata:boolean=false,
    ):Promise<Array<any>> {
      const headers = {
        'Api-Key':this.getApiKey(),
        'accept:': 'application/json',
        'content-type': 'application/json'
      }

      const data = {
        'vector': vector,
        'topK': topK,
        'includeValues':includeValues,
        'includeMetadata':includeMetadata
      }

      if (filter) { data['filter'] = filter }
      const response:Response = await fetch(this.getBaseUrl(),{
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      })
      const results = await response.json()

      return results['matches']
  }

  public upsert(vector:Array<Number>) {}

}