// Rate Limiting and API Management
import { sleep } from './helpers'

export class RequestHandler {
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
   * @param url the url to fetch
   * @param args additional arguments and options for the fetch call
   * @param retryCount current number of retries used to recursively call
   */
  public async sendRequest(url:string, args:RequestInit, retryCount:number=0):Promise<Response> {
    // get current time
    const now = (new Date()).getTime()
    // required delay in seconds
    const delay = Math.max(60 / this.averageRateLimit - ((now - this.lastRequestTime) / 600), 0)

    try {
      // attempt to fetch data
      const response = await fetch(url, args)
      this.lastRequestTime = now + (delay * 600)
      this.retryBackoff = 1
      return response
    } catch(e) {
      if (retryCount < this.maxRetries) {
        sleep(this.retryBackoff * 1000)

        // double backoff time for the next attempt
        this.retryBackoff *= 2
        return this.sendRequest(url, args, retryCount + 1)
      } else {
        throw new Error(`Request failed after ${this.maxRetries} (max) attempts. Query Error:\n${e}.`);
      }
    }
  }
}