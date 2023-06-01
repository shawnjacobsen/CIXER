# helpers for document handling
import io
import requests
import pdfplumber
from langchain.text_splitter import CharacterTextSplitter
from helpers import send_auth_request


def get_document_chunks(content:str):
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

def get_sharepoint_document(auth_token, file_path):
  """
  Get text content from Sharepoint file
  :param auth_token (str): Sharepoint Auth Token
  :param file_path (str): location of file in sharepoint from the root directory (i.e. "documents/example.pdf")
  """
  # get PDF file from sharepoint
  sharepoint_file_endpoint = f"sites/root/drive/root:/{file_path}"
  response = send_msgraph_request(auth_token, sharepoint_file_endpoint, "GET")
  pdf_content = response.content

  # Read the PDF and extract text
  pdf_stream = io.BytesIO(pdf_content)

  full_file_text = ""
  with pdfplumber.open(pdf_stream) as pdf:
    for page in pdf.pages:
      full_file_text += page.extract_text()
  return full_file_text

def get_sharepoint_chunk(auth_token, file_path, document_index):
  """
  Get document chunk (piece) from Sharepoint file
  :param auth_token (str): Sharepoint Auth Token
  :param file_path (str): location of file in sharepoint from the root directory (i.e. "documents/example.pdf")
  :param document_index (int): index of chunk in document. document_index > len(<document chunks>) => document_index = len(<document chunks>) - 1
  """
  # get entire document content
  full_file_text = get_sharepoint_document(auth_token, file_path)

  # get corresponding document chunk by the specified index
  chunks = get_document_chunks(full_file_text)

  if (document_index >= len(chunks)):
      document_index = len(chunks) - 1
  chunk = chunks[document_index]
  return chunk

def user_has_access_to_file(auth_token, user_email, file_path):
  """
  Check if user has access to some file
  :param auth_token (str): Sharepoint Auth Token
  :param user_email (str): user email to check
  :param file_path (str): location of file in sharepoint from the root directory (i.e. "documents/example.pdf")
  """
  permission_endpoint = f"sites/root/drive/root:/{file_path}:/permissions"
  response = send_msgraph_request(auth_token, permission_endpoint, "GET")
  permissions = response.json().get('value', [])

  for permission in permissions:
    if permission.get('grantedTo', {}).get('user', {}).get('email') == user_email and permission.get('roles'):
      return True
  return False

def get_onedrive_file_names(auth_token):
  """ Retrieves onedrive files for root acces given access token

  :param auth_token (str): Microsoft Graph API Access token
  :return file_names (list(str) or str): returns list of file names or error message
  """
  file_names = []

  # Get files in root directory of OneDrive
  files_response = send_msgraph_request(auth_token, "me/drive/root/children", "GET")

  if files_response.status_code == 200:
    files = files_response.json()['value']
    for file in files:
      file_names.append((file['name'], file['@microsoft.graph.downloadUrl']))
  else:
    return f"Error getting files: {files_response.text}"

  return file_names