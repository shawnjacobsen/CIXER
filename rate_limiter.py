import time

class ApiLimiter:
    def __init__(self, rpm, cpm):
        self.requests_per_minute = rpm
        self.chars_per_minute = cpm

    def send_request(self, text):
        time.sleep(self.get_delay(len(text)))
        api_send_request(text)

    # Calculates the delay required to maintain the rate limit
    def get_delay(self, text_length, buffer=0.1):
        optimal = 60.0 / min(self.requests_per_minute, self.chars_per_minute / text_length)
        return optimal * (1 + buffer)


def api_send_request(text):
    print("Sent Request", text)
