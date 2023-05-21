from rate_limiter import ApiLimiter

api_limiter = ApiLimiter(100,1000)

for i in range(200):
    api_limiter.send_request(f"payload #{i}")