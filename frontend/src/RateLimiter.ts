// Rate Limiting and API Management
import { sleep } from './helpers'

class SendRequest {
  averageRateLimit: number  // Average number of requests allowed per minute.
  maxRetries: number        // Max number of query retries before failing. 
  lastRequestTime: number   // the last time the specified query was sent (as Date getTime())
  retryBackoff: number      // the current backoff time in seconds
  /**
   * Initializes the Api object.
   * @param averageRateLimit Average number of requests allowed per minute. 
   * @param maxRetries max number of query retries before failing. 
   */ 
  constructor(averageRateLimit:number, maxRetries:number=5) {
    this.averageRateLimit = averageRateLimit
    this.maxRetries = maxRetries
    this.lastRequestTime = new Date(0).getTime()
    this.retryBackoff = 1
  }
  
  /**
   * Sends a request to the API (function). If the request fails, retry using an exponential back-off strategy.
   * @param query Callable function that sends a request to the API
   * @param args the positional arguments, in order, for the query
   * @param retryCount current number of retries used to recursively call
   */
  public sendRequest(query:Function, args:{}, retryCount:number=0) {
    // get current time
    const now = (new Date()).getTime()
    // required delay in seconds
    const delay = Math.max(60 / this.averageRateLimit - ((now - this.lastRequestTime) / 600), 0)

    try {
      // TODO: add arguments previously provided to query
      const response = query()
      this.lastRequestTime = now + (delay * 600)
      this.retryBackoff = 1
      return response
    } catch(e) {
      if (retryCount < this.maxRetries) {
        sleep(this.retryBackoff * 1000)

        // double backoff time for the next attempt
        this.retryBackoff *= 2
        return this.sendRequest(query, args, retryCount + 1)
      } else {
        throw new Error(`Request failed after ${this.maxRetries} (max) attempts. Query Error:\n${e}.`);
      }
    }
  }

  /**
   * Sends a payload alongside the query, splitting the payload into chunks if its length exceeds the defined payload length limit.
   * Each chunk is sent separately via sendRequest method.
   * @param query The function that sends a request to the API
   * @param payload The list of vectors/data to be sent as a payload.
   * @param payloadLengthLimit longest allowed length of the sent payload
   * @return array of resuls from each chunked API request
   */
  public sendPayload(query:Function, payload:Array<any>, payloadLengthLimit=100):Array<any> {
    let results:Array<any> = []

    // TODO: ensure sendRequest is being used properly
    for (let i=0; i < payload.length; i += payloadLengthLimit) {
      const chunk = payload.slice(i,i+payloadLengthLimit)
      const result = this.sendRequest(query, chunk)
      results.push(result)
    }

    return results
  }

}