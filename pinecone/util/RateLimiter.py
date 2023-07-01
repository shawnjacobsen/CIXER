import time
import sys

class Api:
    """
    Class to manage API requests, ensuring that requests are sent at a 
    rate no higher than the average rate limit, with exponential back-off 
    strategy for retries when API requests fail.
    """
    def __init__(self, average_rate_limit, max_retries=5):
        """
        Initializes the Api object.
        :param average_rate_limit: Average number of requests allowed per minute.
        """
        self.average_rate_limit = average_rate_limit
        self.last_request_time = 0
        self.max_retries = max_retries
        # The current backoff factor
        self.retry_backoff = 1

    def send_request(self, function, *args, retry_count=0, **kwargs):
        """
        Sends a request to the API (function). If the request fails, retry using an 
        exponential back-off strategy.

        :param function: The function that sends a request to the API.
        :param args: The positional arguments for the function.
        :param max_retries: maximum number of retries in a row. Defaults to 5
        :param kwargs: The keyword arguments for the function.
        :return: The result of the function call.
        """
        now = time.time()
        delay = max(60 / self.average_rate_limit - (now - self.last_request_time), 0)
        time.sleep(delay)

        try:
            result = function(*args, **kwargs)
            # Reset last request time and backoff on successful request
            self.last_request_time = now + delay
            self.retry_backoff = 1
            return result
        except Exception as e:
            if retry_count < self.max_retries:
                # print(f"Request failed with error {e}. Retrying in {self.retry_backoff} seconds...")
                time.sleep(self.retry_backoff)
                # Double the backoff time for the next attempt
                self.retry_backoff *= 2
                return self.send_request(function, *args, retry_count=retry_count + 1, **kwargs)
            else:
                raise Exception(f"Request failed after {self.max_retries} (max) attempts:\n{e}.")
            
    def send_payload(self, function, payload, payload_length_limit=100):
        """
        Sends a payload (list) to a specified API function, splitting the payload into chunks if its length exceeds 
        the defined payload length limit. Each chunk is sent separately via send_request method.

        :param function: The function that sends a request to the API.
        :param payload: The list of vectors/data to be sent as a payload.
        :param args: The positional arguments for the function.
        :param kwargs: The keyword arguments for the function.
        :return: A list of results from each chunked API request.
        """
        results = []

        for i in range(0, len(payload), payload_length_limit):
            chunk = payload[i:i+payload_length_limit]
            result = self.send_request(function, chunk)
            results.append(result)
        
        return results    