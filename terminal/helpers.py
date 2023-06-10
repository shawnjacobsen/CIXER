import requests
import datetime
import time
import json


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

def timestamp_to_datetime(unix_time):
  return datetime.datetime.fromtimestamp(unix_time).strftime("%A, %B %d, %Y at %I:%M%p %Z")

def get_datetime():
  timestamp = time.time()
  return timestamp_to_datetime(timestamp)

def open_file(filepath):
  with open(filepath, 'r', encoding='utf-8') as infile:
    return infile.read()

def save_file(filepath, content):
  with open(filepath, 'w', encoding='utf-8') as outfile:
    outfile.write(content)

def load_json(filepath):
  with open(filepath, 'r', encoding='utf-8') as infile:
    return json.load(infile)

def save_json(filepath, payload):
  with open(filepath, 'w', encoding='utf-8') as outfile:
    json.dump(payload, outfile, ensure_ascii=False, sort_keys=True, indent=2)