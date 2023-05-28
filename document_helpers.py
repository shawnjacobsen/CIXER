# helpers for document handling
import io
import requests
from langchain.text_splitter import CharacterTextSplitter
import pdfplumber


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

def get_sharepoint_document(auth_token, sharepoint_file_url):
  """
  Get text content from generic Sharepoint file
  :param auth_token (str): Sharepoint JWT
  :param sharepoint_file_url (str): location of file
  """
  # get PDF file from sharepoint
  headers = {'Authorization': f'Bearer {auth_token}'}
  response = requests.get(sharepoint_file_url, headers=headers)
  pdf_content = response.content

  # Read the PDF and extract text
  pdf_stream = io.BytesIO(pdf_content)

  full_file_text = ""
  with pdfplumber.open(pdf_stream) as pdf:
    for page in pdf.pages:
      full_file_text += page.extract_text()
  return full_file_text

def get_sharepoint_chunk(auth_token, sharepoint_file_url, document_index):
  
  # get entire document content
  full_file_text = get_sharepoint_document(auth_token, sharepoint_file_url)

  # get corresponding document chunk by the specified index
  chunks = get_document_chunks(full_file_text)

  if (document_index >= len(chunks)):
      document_index = len(chunks) - 1
  chunk = chunks[document_index]
  return chunk

def user_has_access_to_file(auth_token, user_email, sharepoint_file_location):
  headers = {'Authorization': f'Bearer {auth_token}'}
  file_url = f'https://graph.microsoft.com/v1.0/sites/root/drive/root:/{sharepoint_file_location}:/permissions'
  response = requests.get(file_url, headers=headers)
  permissions = response.json().get('value', [])

  for permission in permissions:
    if permission.get('grantedTo', {}).get('user', {}).get('email') == user_email and permission.get('roles'):
      return True
  return False