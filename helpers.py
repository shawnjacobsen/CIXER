import requests


def send_auth_request(auth_token, url, method:str, data_payload={}):
  """
  Query Msome API using the request library and return the reponse
  :param auth_token (str): Authentication Bearer Token
  :param url (str): Generic request URL
  :param method (str): HTTP request method of literals "GET", "POST", "DELETE", "PUT", "PATCH"
  :param data_payload (dict): optional payload to pass in request data parameter
  """
  valid_methods = {
    "GET":requests.get,
    "POST":requests.post,
    "DELETE":requests.delete,
    "PUT":requests.put,
    "PATCH":requests.patch
  }
  if method not in valid_methods:
    raise ValueError(f"Invalid HTTP method specified. Value should be one of {list(valid_methods.keys())}")
  
  headers = {'Authorization': f'Bearer {auth_token}'}
  http_response = valid_methods[method](url, headers=headers, data=data_payload)
  return http_response