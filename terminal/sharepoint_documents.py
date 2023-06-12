# helpers for document handling
from io import BytesIO
import requests
from pdfminer.high_level import extract_text
from langchain.text_splitter import CharacterTextSplitter
from helpers import send_auth_request


def get_content_chunks(content:str):
  """
  Returns a semantically separated list of text chunks given a single string of text content
  :param content (str): a single text string to be separated using a semantic text splitter
  """
  text_splitter = CharacterTextSplitter(      
    separator = "\n",
    chunk_size = 1000,
    chunk_overlap  = 200,
    length_function = len,
  )
  return text_splitter.split_text(content)
  
def get_access_token(client_id, client_secret, tenant_id):
  """
  Queries Sharepoint JWT
  :param client_id (str): Found in Active Directory
  :param client_secret (str): Found in Active Directory
  :param tenant_id (str): Found in Active Directory
  :returns access_token (str): JWT bearer for future requests on behalf of client
  """
  token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
  token_payload = {
    'grant_type': 'client_credentials',
    'client_id': client_id,
    'client_secret': client_secret,
    'scope': 'https://graph.microsoft.com/.default'
  }
  response = requests.post(token_url, data=token_payload)
  access_token = response.json().get('access_token')
  return access_token

def send_msgraph_request(auth_token, path, method:str, data_payload={}):
  """
  Query Microsoft Graph API (https://graph.microsoft.com/v1.0/) and return the reponse
  :param auth_token (str): Sharepoint Authentication Token
  :param path (str): Microsoft Graph API endpoint path (i.e. "me/drive/root/children")
  :param method (str): HTTP request method of literals "GET", "POST", "DELETE", "PUT", "PATCH"
  :param data_payload (dict): optional payload to pass in request data parameter
  """
  request_url = f"https://graph.microsoft.com/v1.0/{path}"
  return send_auth_request(auth_token,request_url, method, data_payload)

def get_sharepoint_document(auth_token, document_id):
  """
  Get text content from Sharepoint file
  :param auth_token (str): Sharepoint Auth Token
  :param document_id (str): id of file in sharepoint
  """
  # get PDF file from sharepoint
  sharepoint_file_endpoint = f"me/drive/items/{document_id}/content"
  response = send_msgraph_request(auth_token, sharepoint_file_endpoint, "GET")

  if response.status_code == 200:
    if 'application/pdf' in response.headers.get('Content-Type', ''):
      print("is PDF\n")
      pdf_content = BytesIO(response.content)
      try:
        text = extract_text(pdf_content)
        return text
      except Exception as e:
        print("Error while extracting text:", str(e))
        return None
    else:
      print(f"The downloaded content is not a PDF: type={response.headers.get('Content-Type', '')}")
      return None
  else:
    print(f"Error downloading file: {response.text}")
    return None

def get_sharepoint_chunk(auth_token:str, document_id:str, document_index:int):
  """
  Get document chunk (piece) from Sharepoint file
  :param auth_token (str): Sharepoint Auth Token
  :param document_id (str): id of file in sharepoint
  :param document_index (int): index of chunk in document. document_index > len(<document chunks>) => document_index = len(<document chunks>) - 1
  """
  # get entire document content
  full_file_text = get_sharepoint_document(auth_token, document_id)

  # get corresponding document chunk by the specified index
  chunks = get_content_chunks(full_file_text)

  if (document_index >= len(chunks)):
      document_index = len(chunks) - 1
  chunk = chunks[document_index]
  return chunk

def get_user_email_by_token(auth_token:str):
  """
  Request the associated email with the provided Microsoft Graph API Access Token
  :param auth_token (str): Sharepoint Auth Token
  :return user_email or error code (str)
  """
  res = send_msgraph_request(auth_token, 'me', 'GET')
  data = res.json()
  if res.status_code == 200:
    return data['mail']
  else:
    return f"\nFailed to get user email. Error {res.status_code}\n{data['error']['message']}"


def user_has_access_to_file(auth_token, document_id):
  """
  Check if user has access to some file
  :param auth_token (str): Sharepoint Auth Token
  :param document_id (str): id of file in sharepoint
  :return True if user has access else False or error (str)
  """
  permission_endpoint = f"me/drive/items/{document_id}"
  response = send_msgraph_request(auth_token, permission_endpoint, "GET")

  if response.status_code == 200:
    return True
  elif response.status_code == 404:
    return False
  else:
    return "Error determining file access"

def get_onedrive_file_names(auth_token):
  """
  Retrieves onedrive files for root acces given access token
  :param auth_token (str): Microsoft Graph API Access token
  :return file_names & ids (list(str,str) or str): returns list of file names and location or error message
  """
  files = []

  # Get files in root directory of OneDrive
  files_response = send_msgraph_request(auth_token, "me/drive/root/children", "GET")

  if files_response.status_code == 200:
    raw_files = files_response.json()['value']
    for file in raw_files:
      files.append((file['name'], file['id']))
  else:
    return f"Error getting files: {files_response.text}"

  return files